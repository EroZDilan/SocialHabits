import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
  AppState
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import HabitManagementModal from '../components/HabitManagementModal';
import DraggableFloatingButton from '../components/DraggableFloatingButton'; 

const { width, height } = Dimensions.get('window');

export default function HabitsScreen() {
  // =====================================================
  // 🏗️ SECCIÓN 1: ESTADOS PRINCIPALES
  // =====================================================
  // Estos estados manejan los datos fundamentales de la pantalla
  const { user } = useAuth();
  
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para el sistema de reinicio diario
  const [currentAppDate, setCurrentAppDate] = useState(new Date().toISOString().split('T')[0]);
  const dailyCheckIntervalRef = useRef(null);
  
  // Estados para animaciones y mensajes
  const [celebrationAnim] = useState(new Animated.Value(0));
  const [motivationalMessage, setMotivationalMessage] = useState('');
  const [messageOpacity] = useState(new Animated.Value(0));
  const messageTimeoutRef = useRef(null);

  // Estados para funcionalidad social
  const [availableSharedHabits, setAvailableSharedHabits] = useState([]);
  const [loadingAvailableHabits, setLoadingAvailableHabits] = useState(false);
  
  // Estados para modales y controles
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [deletingHabitId, setDeletingHabitId] = useState(null);

  // =====================================================
  // 🧮 SECCIÓN 2: FUNCIONES UTILITARIAS DE CÁLCULO
  // =====================================================
  
  // Esta función determina el nivel del usuario basándose en su experiencia acumulada
  const calculateLevel = (experience) => {
    return Math.floor(experience / 100) + 1;
  };

  // Esta función calcula cuánta experiencia gana el usuario por completar un hábito
  const calculateExperienceGained = (currentStreak) => {
    let baseExperience = 10;
    let streakBonus = 0;
    
    if (currentStreak >= 7) streakBonus += 5;
    if (currentStreak >= 14) streakBonus += 10;
    if (currentStreak >= 30) streakBonus += 20;
    
    if (currentStreak > 30) {
      streakBonus += Math.floor((currentStreak - 30) / 7) * 5;
    }
    
    return baseExperience + streakBonus;
  };

  // Esta función calcula la racha actual considerando días de descanso
  const calculateCurrentStreak = (completions, restDays) => {
    if (!completions || completions.length === 0) {
      console.log('📊 calculateCurrentStreak: No hay completaciones');
      return 0;
    }

    const completionDates = completions
      .map(c => new Date(c.completed_date))
      .sort((a, b) => b - a);

    const restDatesSet = new Set(
      restDays.map(r => new Date(r.rest_date).toISOString().split('T')[0])
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let currentDate = new Date(today);

    console.log('📊 calculateCurrentStreak: Iniciando cálculo desde', currentDate.toISOString().split('T')[0]);

    for (let i = 0; i < 365; i++) {
      const dateString = currentDate.toISOString().split('T')[0];
      
      const hasCompletion = completionDates.some(d => {
        const completionDateString = d.toISOString().split('T')[0];
        return completionDateString === dateString;
      });
      
      const isRestDay = restDatesSet.has(dateString);

      if (hasCompletion) {
        streak++;
        console.log(`✅ Día ${dateString}: Completado, racha = ${streak}`);
      } else if (isRestDay) {
        console.log(`😴 Día ${dateString}: Descanso, racha se mantiene = ${streak}`);
      } else {
        console.log(`❌ Día ${dateString}: Sin actividad, racha rota`);
        break;
      }

      currentDate.setDate(currentDate.getDate() - 1);
    }

    console.log(`📊 calculateCurrentStreak: Racha final = ${streak}`);
    return streak;
  };

  // Esta función encuentra la mejor racha histórica del usuario
  const calculateBestStreak = (completions, restDays) => {
    if (!completions || completions.length === 0) {
      return 0;
    }

    console.log('📊 calculateBestStreak: Analizando', completions.length, 'completaciones');

    const currentStreak = calculateCurrentStreak(completions, restDays);
    
    const estimatedBestStreak = completions.length > 10 
      ? Math.max(currentStreak, Math.floor(completions.length / 3))
      : currentStreak;

    console.log('📊 calculateBestStreak: Mejor racha estimada =', estimatedBestStreak);
    return Math.max(currentStreak, estimatedBestStreak);
  };

  // Esta función calcula la experiencia total basándose en completaciones y rachas
  const calculateTotalExperience = (completions, currentStreak) => {
    const baseExperience = completions.length * 10;
    
    let streakBonus = 0;
    if (currentStreak >= 3) streakBonus += 15;
    if (currentStreak >= 7) streakBonus += 35;
    if (currentStreak >= 14) streakBonus += 50;
    if (currentStreak >= 30) streakBonus += 100;
    
    if (currentStreak > 30) {
      streakBonus += Math.floor((currentStreak - 30) / 7) * 25;
    }

    const totalExperience = baseExperience + streakBonus;
    
    console.log('📊 calculateTotalExperience:', {
      completions: completions.length,
      baseExperience,
      currentStreak,
      streakBonus,
      totalExperience
    });

    return totalExperience;
  };

  // =====================================================
  // 🎯 SECCIÓN 3: SISTEMA DE MENSAJES MOTIVACIONALES
  // =====================================================

  // Esta función genera mensajes personalizados basándose en el progreso del usuario
  const generateMotivationalMessage = (habit, isNewRecord = false) => {
    const streak = habit.currentStreak;
    const name = habit.name;
    
    if (isNewRecord) {
      const recordMessages = [
        `🏆 ¡NUEVO RÉCORD! ${streak} días consecutivos con ${name}. ¡Eres imparable!`,
        `🎉 ¡RÉCORD PERSONAL! ${streak} días seguidos. ¡Superaste tu marca anterior!`,
        `🚀 ¡HISTORIA EN CONSTRUCCIÓN! ${streak} días de pura disciplina con ${name}!`
      ];
      return recordMessages[Math.floor(Math.random() * recordMessages.length)];
    }

    if (streak === 1) {
      const firstDayMessages = [
        `🌱 ¡Excelente inicio! Primer día de ${name} completado. ¡El viaje comienza!`,
        `✨ ¡Primer paso dado! ${name} en marcha. ¡Cada gran hábito empieza así!`,
        `🎯 ¡Perfecto! Un día de ${name} hecho. ¡La constancia construye grandes cosas!`
      ];
      return firstDayMessages[Math.floor(Math.random() * firstDayMessages.length)];
    }

    if (streak === 3) return `🔥 ¡3 días seguidos con ${name}! El hábito está tomando forma. ¡Keep going!`;
    if (streak === 7) return `🎊 ¡UNA SEMANA COMPLETA! 7 días de ${name}. ¡Esto ya es un hábito real!`;
    if (streak === 14) return `💎 ¡DOS SEMANAS! ${streak} días de ${name}. ¡Tu disciplina es inspiradora!`;
    if (streak === 30) return `👑 ¡UN MES ENTERO! ${streak} días con ${name}. ¡Eres oficialmente un HÁBITO MASTER!`;
    if (streak === 100) return `🌟 ¡CIEN DÍAS! ¡LEGENDARY STATUS! ${name} está en tu DNA ahora. ¡INCREÍBLE!`;

    if (streak <= 5) {
      const shortMessages = [
        `💪 ¡${streak} días con ${name}! Cada día cuenta hacia tu transformación.`,
        `⚡ ¡Genial! ${streak} días seguidos. ¡El momentum está creciendo!`,
        `🎯 ¡${streak} días! Tu futuro yo ya está agradecido.`
      ];
      return shortMessages[Math.floor(Math.random() * shortMessages.length)];
    }

    if (streak <= 15) {
      const mediumMessages = [
        `🚀 ¡WOW! ${streak} días con ${name}. ¡Eres una máquina de consistencia!`,
        `⭐ ¡Impresionante! ${streak} días seguidos. ¡Esta disciplina te llevará lejos!`,
        `🔥 ¡${streak} días! Tu dedicación a ${name} es admirable.`
      ];
      return mediumMessages[Math.floor(Math.random() * mediumMessages.length)];
    }

    const longMessages = [
      `👑 ¡ÉPICO! ${streak} días con ${name}. ¡Eres la definición de disciplina!`,
      `🌟 ¡LEYENDA! ${streak} días consecutivos. ¡Tu constancia es inspiradora!`,
      `💎 ¡IMPARABLE! ${streak} días de ${name}. ¡Esto es pura excelencia!`,
      `🏆 ¡CHAMPION LEVEL! ${streak} días seguidos. ¡Tu determinación es increíble!`
    ];
    return longMessages[Math.floor(Math.random() * longMessages.length)];
  };

  // Esta función maneja la visualización temporal de mensajes motivacionales
  const showMotivationalMessage = (message) => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }

    messageOpacity.setValue(0);
    setMotivationalMessage(message);

    Animated.timing(messageOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    messageTimeoutRef.current = setTimeout(() => {
      Animated.timing(messageOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        setMotivationalMessage('');
        messageTimeoutRef.current = null;
      });
    }, 5000);
  };

  // Esta función ejecuta la animación de celebración cuando se completa un hábito
  const celebrateCompletion = () => {
    celebrationAnim.setValue(0);
    
    Animated.sequence([
      Animated.timing(celebrationAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(celebrationAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  };

  // =====================================================
  // 🔄 SECCIÓN 4: SISTEMA DE REINICIO DIARIO
  // =====================================================

  // Esta función es el corazón del nuevo sistema de reinicio automático
  const checkAndHandleDayReset = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('🌅 Verificando cambio de día:', { currentAppDate, today });
    
    if (currentAppDate !== today) {
      console.log('🔄 ¡Nuevo día detectado! Reiniciando estado de hábitos...');
      
      setCurrentAppDate(today);
      await performDailyReset();
      showNewDayMessage();
    }
  };

  // Esta función ejecuta el reinicio diario recargando todos los datos desde la base de datos
  const performDailyReset = async () => {
    console.log('🔄 Ejecutando reinicio diario de hábitos...');
    
    try {
      await loadUserHabits();
      console.log('✅ Reinicio diario completado exitosamente');
    } catch (error) {
      console.error('❌ Error durante el reinicio diario:', error);
    }
  };

  // Esta función muestra mensajes especiales al comenzar un nuevo día
  const showNewDayMessage = () => {
    const messages = [
      '🌅 ¡Nuevo día, nuevas oportunidades! Vamos a por esos hábitos.',
      '✨ ¡Un día fresco para construir tu mejor versión!',
      '🎯 ¡Comienza el día con energía y propósito!',
      '💪 ¡Tu futuro yo te lo agradecerá!'
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    showMotivationalMessage(randomMessage);
  };

  // =====================================================
  // 🎯 SECCIÓN 5: FUNCIÓN PRINCIPAL DE COMPLETAR HÁBITO
  // =====================================================

  // Esta es la función más crítica de toda la aplicación
  const completeHabit = async (habitId) => {
    console.log('🎯 completeHabit: Iniciando para habitId:', habitId);
    
    await checkAndHandleDayReset();
    
    const habitToComplete = habits.find(h => h.id === habitId);
    if (!habitToComplete) {
      console.error('❌ completeHabit: Hábito no encontrado');
      Alert.alert('Error', 'Hábito no encontrado. Intenta recargar la pantalla.');
      return;
    }
    
    if (habitToComplete.isCompleted) {
      console.log('⚠️ completeHabit: Hábito ya completado hoy');
      Alert.alert('Ya Completado', 'Ya completaste este hábito hoy. ¡Excelente trabajo!');
      return;
    }

    console.log('📝 completeHabit: Completando hábito:', habitToComplete.name);

    try {
      const today = new Date().toISOString().split('T')[0];
      
      console.log('💾 completeHabit: Guardando completación en base de datos...');
      const { data: completionData, error: completionError } = await supabase
        .from('habit_completions')
        .insert({
          habit_id: habitId,
          user_id: user.id,
          completed_date: today,
          notes: null
        })
        .select()
        .single();

      if (completionError) {
        console.error('❌ completeHabit: Error al guardar completación:', completionError);
        
        if (completionError.code === '23505') {
          Alert.alert('Ya Completado', 'Ya completaste este hábito hoy según nuestros registros.');
        } else {
          Alert.alert('Error', 'No se pudo registrar la completación. Intenta nuevamente.');
        }
        return;
      }

      console.log('✅ completeHabit: Completación guardada exitosamente');

      const updatedStats = await calculateHabitStats(habitId);
      
      setHabits(currentHabits => {
        return currentHabits.map(habit => {
          if (habit.id === habitId) {
            const updatedHabit = {
              ...habit,
              ...updatedStats
            };
            
            console.log('🎉 completeHabit: Hábito actualizado:', updatedHabit.name);
            
            setTimeout(() => {
              celebrateCompletion();
              const isNewRecord = updatedStats.currentStreak > habitToComplete.bestStreak;
              console.log('🏆 ¿Es nuevo récord?', isNewRecord);
              const message = generateMotivationalMessage(updatedHabit, isNewRecord);
              showMotivationalMessage(message);
            }, 100);
            
            return updatedHabit;
          }
          return habit;
        });
      });

    } catch (error) {
      console.error('💥 completeHabit: Error inesperado:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    }
  };

  // =====================================================
  // 😴 SECCIÓN 6: SISTEMA DE DÍAS DE DESCANSO
  // =====================================================

  const markRestDay = async (habitId) => {
    console.log('😴 markRestDay: Iniciando para habitId:', habitId);

    await checkAndHandleDayReset();

    const habitToRest = habits.find(h => h.id === habitId);
    if (!habitToRest) {
      console.error('❌ markRestDay: Hábito no encontrado');
      return;
    }

    if (!habitToRest.allow_rest_days) {
      Alert.alert('No Permitido', 'Este hábito no permite días de descanso planificados.');
      return;
    }

    if (habitToRest.isCompleted) {
      Alert.alert('Ya Completado', 'Ya completaste este hábito hoy. No necesitas marcarlo como día de descanso.');
      return;
    }

    if (habitToRest.hasRestDay) {
      Alert.alert('Ya Marcado', 'Ya marcaste hoy como día de descanso para este hábito.');
      return;
    }

    Alert.alert(
      '¿Día de descanso?',
      `¿Estás seguro de que quieres marcar hoy como día de descanso para ${habitToRest.name}? Esto mantendrá tu racha activa.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sí, es descanso',
          onPress: async () => {
            try {
              const today = new Date().toISOString().split('T')[0];
              
              console.log('💾 markRestDay: Guardando día de descanso...');
              const { data, error } = await supabase
                .from('habit_rest_days')
                .insert({
                  habit_id: habitId,
                  user_id: user.id,
                  rest_date: today,
                  reason: 'Día de descanso planificado'
                })
                .select()
                .single();

              if (error) {
                console.error('❌ markRestDay: Error al guardar:', error);
                
                if (error.code === '23505') {
                  Alert.alert('Ya Registrado', 'Ya has marcado hoy como día de descanso.');
                } else {
                  Alert.alert('Error', 'No se pudo registrar el día de descanso.');
                }
                return;
              }

              console.log('✅ markRestDay: Día de descanso guardado exitosamente');

              const updatedStats = await calculateHabitStats(habitId);
              
              setHabits(currentHabits => {
                return currentHabits.map(habit => {
                  if (habit.id === habitId) {
                    return {
                      ...habit,
                      ...updatedStats
                    };
                  }
                  return habit;
                });
              });

              const restMessage = `😴 Día de descanso registrado para ${habitToRest.name}. Tu racha se mantiene activa.`;
              showMotivationalMessage(restMessage);

            } catch (error) {
              console.error('💥 markRestDay: Error inesperado:', error);
              Alert.alert('Error', 'Ocurrió un error inesperado.');
            }
          }
        }
      ]
    );
  };

  // =====================================================
  // 📊 SECCIÓN 7: CÁLCULO DE ESTADÍSTICAS DE HÁBITOS
  // =====================================================

  const calculateHabitStats = async (habitId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      console.log(`📊 Calculando estadísticas para hábito ${habitId} en fecha ${today}`);

      const { data: completions, error: completionsError } = await supabase
        .from('habit_completions')
        .select('completed_date')
        .eq('habit_id', habitId)
        .eq('user_id', user.id)
        .order('completed_date', { ascending: false });

      if (completionsError) {
        console.error('Error al obtener completaciones:', completionsError);
        return getDefaultStats();
      }

      const { data: restDays, error: restError } = await supabase
        .from('habit_rest_days')
        .select('rest_date')
        .eq('habit_id', habitId)
        .eq('user_id', user.id);

      if (restError) {
        console.error('Error al obtener días de descanso:', restError);
      }

      const isCompletedToday = completions.some(c => c.completed_date === today);
      const hasRestDayToday = (restDays || []).some(r => r.rest_date === today);
      
      console.log(`📊 Estado del día ${today}:`, { isCompletedToday, hasRestDayToday });

      const currentStreak = calculateCurrentStreak(completions, restDays || []);
      const bestStreak = calculateBestStreak(completions, restDays || []);
      const totalCompletions = completions.length;
      const experience = calculateTotalExperience(completions, currentStreak);
      const level = calculateLevel(experience);

      const stats = {
        currentStreak,
        bestStreak,
        totalCompletions,
        experience,
        level,
        isCompleted: isCompletedToday,
        hasRestDay: hasRestDayToday,
        completions: completions.map(c => c.completed_date),
        restDays: (restDays || []).map(r => r.rest_date)
      };

      console.log(`📊 Estadísticas calculadas:`, stats);
      return stats;

    } catch (error) {
      console.error('Error al calcular estadísticas:', error);
      return getDefaultStats();
    }
  };

  const getDefaultStats = () => ({
    currentStreak: 0,
    bestStreak: 0,
    totalCompletions: 0,
    experience: 0,
    level: 1,
    isCompleted: false,
    hasRestDay: false,
    completions: [],
    restDays: []
  });

  // =====================================================
  // 📂 SECCIÓN 8: GESTIÓN DE MODALES Y HÁBITOS
  // =====================================================

  const openCreateHabitModal = () => {
    console.log('Abriendo modal para crear nuevo hábito');
    setEditingHabit(null);
    setShowManagementModal(true);
  };

  const openEditHabitModal = (habit) => {
    console.log('Abriendo modal para editar hábito:', habit.name);
    setEditingHabit(habit);
    setShowManagementModal(true);
  };

  const closeManagementModal = () => {
    console.log('Cerrando modal de gestión');
    setShowManagementModal(false);
    setEditingHabit(null);
  };

  const handleHabitSaved = async (savedHabit) => {
    console.log('Hábito guardado exitosamente:', savedHabit.name);
    
    try {
      if (editingHabit) {
        console.log('Actualizando hábito existente en la lista local');
        
        const updatedStats = await calculateHabitStats(savedHabit.id);
        
        setHabits(currentHabits => {
          return currentHabits.map(habit => {
            if (habit.id === savedHabit.id) {
              return {
                ...savedHabit,
                ...updatedStats
              };
            }
            return habit;
          });
        });
      } else {
        console.log('Añadiendo nuevo hábito a la lista local');
        
        const initialStats = await calculateHabitStats(savedHabit.id);
        
        const newHabitWithStats = {
          ...savedHabit,
          ...initialStats
        };
        
        setHabits(currentHabits => [newHabitWithStats, ...currentHabits]);
      }
    } catch (error) {
      console.error('Error al actualizar la lista local después de guardar:', error);
      await loadUserHabits();
    }
  };

  const handleDeleteHabit = (habit) => {
    console.log('Iniciando eliminación de hábito:', habit.name);
    
    Alert.alert(
      'Eliminar Hábito',
      `¿Estás seguro de que quieres eliminar "${habit.name}"?\n\nEsto ocultará el hábito de tu lista, pero conservará tu historial de progreso.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => console.log('Eliminación cancelada por el usuario')
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => confirmDeleteHabit(habit)
        }
      ]
    );
  };

  const confirmDeleteHabit = async (habit) => {
    console.log('Ejecutando eliminación suave para:', habit.name);
    setDeletingHabitId(habit.id);
    
    try {
      const { error } = await supabase
        .from('habits')
        .update({ is_active: false })
        .eq('id', habit.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error al eliminar hábito:', error);
        Alert.alert('Error', 'No se pudo eliminar el hábito. Intenta nuevamente.');
        return;
      }

      console.log('Hábito eliminado exitosamente de la base de datos');

      setHabits(currentHabits => {
        return currentHabits.filter(h => h.id !== habit.id);
      });

      Alert.alert(
        'Hábito Eliminado',
        `"${habit.name}" ha sido eliminado exitosamente.`,
        [{ text: 'OK', style: 'default' }]
      );

    } catch (error) {
      console.error('Error inesperado al eliminar hábito:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setDeletingHabitId(null);
    }
  };

  const showHabitOptions = (habit) => {
    console.log('Mostrando opciones para hábito:', habit.name);
    
    Alert.alert(
      habit.name,
      'Elige una acción para este hábito:',
      [
        {
          text: 'Editar',
          onPress: () => openEditHabitModal(habit)
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => handleDeleteHabit(habit)
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
  };

  // =====================================================
  // 🗂️ SECCIÓN 9: CARGA DE DATOS DESDE LA BASE DE DATOS
  // =====================================================

// Reemplazar la función loadUserHabits completa en HabitsScreen.js
// Revertir loadUserHabits a su funcionalidad original
const loadUserHabits = async () => {
  if (!user) {
    console.log('No hay usuario autenticado, no se pueden cargar hábitos');
    return;
  }

  try {
    console.log('Cargando hábitos para el usuario:', user.email);
    
    // 🔧 SOLO HÁBITOS PROPIOS DEL USUARIO (personales Y adoptados)
    console.log('📱 Cargando hábitos del usuario...');
    const { data: userHabits, error: habitsError } = await supabase
      .from('habits')
      .select(`
        *,
        groups (
          id,
          name,
          description
        )
      `)
      .eq('user_id', user.id)  // Solo hábitos donde el usuario es el propietario
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (habitsError) {
      console.error('Error al cargar hábitos:', habitsError);
      Alert.alert('Error', 'No se pudieron cargar tus hábitos. Intenta nuevamente.');
      return;
    }

    console.log(`📱 Hábitos del usuario cargados: ${userHabits?.length || 0}`);

    // 🔧 SEPARAR HÁBITOS PERSONALES Y ADOPTADOS
    const personalHabits = (userHabits || []).filter(habit => habit.group_id === null);
    const adoptedHabits = (userHabits || []).filter(habit => habit.group_id !== null);

    console.log(`📊 Desglose: ${personalHabits.length} personales, ${adoptedHabits.length} adoptados de grupos`);

    // 🔧 MARCAR HÁBITOS COMO COMPARTIDOS O PERSONALES
    const allHabits = [
      ...personalHabits.map(habit => ({ ...habit, isShared: false })),
      ...adoptedHabits.map(habit => ({ ...habit, isShared: true }))
    ];

    if (allHabits.length === 0) {
      console.log('No se encontraron hábitos, creando hábitos de ejemplo...');
      await createDefaultHabits();
      return;
    }

    // 🔧 CALCULAR ESTADÍSTICAS PARA CADA HÁBITO
    const habitsWithStats = await Promise.all(
      allHabits.map(async (habit) => {
        const stats = await calculateHabitStats(habit.id);
        return {
          ...habit,
          ...stats
        };
      })
    );

    setHabits(habitsWithStats);
    console.log(`🎉 Carga completa: ${habitsWithStats.length} hábitos con estadísticas`);

  } catch (error) {
    console.error('Error inesperado al cargar hábitos:', error);
    Alert.alert('Error', 'Ocurrió un error inesperado. Intenta nuevamente.');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  const getUserGroupIds = async () => {
  try {
    console.log('🔍 Obteniendo IDs de grupos del usuario...');
    
    const { data: memberships, error } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error al obtener IDs de grupos:', error);
      return [];
    }

    const groupIds = memberships?.map(m => m.group_id) || [];
    console.log(`👥 Usuario es miembro de ${groupIds.length} grupos:`, groupIds);
    return groupIds;

  } catch (error) {
    console.error('Error inesperado al obtener IDs de grupos:', error);
    return [];
  }
};

  const createDefaultHabits = async () => {
    console.log('🏗️ createDefaultHabits: Iniciando creación de hábitos de ejemplo');
    
    const defaultHabits = [
      {
        name: 'Ejercicio',
        description: 'Actividad física diaria',
        allow_rest_days: true,
        rest_days_per_week: 2,
        user_id: user.id
      },
      {
        name: 'Leer',
        description: '30 minutos de lectura',
        allow_rest_days: false,
        rest_days_per_week: 0,
        user_id: user.id
      },
      {
        name: 'Meditar',
        description: '10 minutos de meditación',
        allow_rest_days: false,
        rest_days_per_week: 0,
        user_id: user.id
      }
    ];

    try {
      console.log('🔄 createDefaultHabits: Insertando en Supabase...');
      
      const { data, error } = await supabase
        .from('habits')
        .insert(defaultHabits)
        .select();

      if (error) {
        console.error('❌ createDefaultHabits: Error al insertar:', error);
        Alert.alert('Error', `No se pudieron crear hábitos de ejemplo: ${error.message}`);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('✅ createDefaultHabits: Hábitos creados exitosamente, recargando...');
      await loadUserHabits();

    } catch (error) {
      console.error('💥 createDefaultHabits: Error inesperado:', error);
      Alert.alert('Error', `Error inesperado: ${error.message}`);
      setLoading(false);
      setRefreshing(false);
    }
  };
// Reemplazar completamente loadAvailableSharedHabits
const loadAvailableSharedHabits = async () => {
  if (!user) return;

  setLoadingAvailableHabits(true);
  try {
    console.log('🔍 === INICIANDO CARGA DE HÁBITOS DISPONIBLES ===');
    console.log('🔍 User ID:', user.id);

    // 🔧 PASO 1: Obtener grupos del usuario
    const { data: userGroups, error: groupsError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (groupsError) {
      console.error('🔍 Error cargando grupos:', groupsError);
      setAvailableSharedHabits([]);
      return;
    }

    if (!userGroups || userGroups.length === 0) {
      console.log('🔍 Usuario no pertenece a ningún grupo');
      setAvailableSharedHabits([]);
      return;
    }

    const groupIds = userGroups.map(g => g.group_id);
    console.log('🔍 Grupos del usuario:', groupIds);

    // 🔧 PASO 2: Obtener TODOS los hábitos del usuario (para filtrar después)
    const { data: allUserHabits, error: userHabitsError } = await supabase
      .from('habits')
      .select('id, name, group_id, user_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (userHabitsError) {
      console.error('🔍 Error cargando hábitos del usuario:', userHabitsError);
    }

    console.log('🔍 Hábitos del usuario:', allUserHabits?.length || 0);
    
    // 🔧 PASO 3: Crear conjunto de hábitos que YA TENGO
    const myHabitKeys = new Set();
    (allUserHabits || []).forEach(habit => {
      if (habit.group_id) {
        // Para hábitos de grupo, usar group_id + name
        myHabitKeys.add(`${habit.group_id}-${habit.name}`);
        console.log(`🔍 Ya tengo hábito: "${habit.name}" del grupo ${habit.group_id}`);
      }
    });

    console.log('🔍 Total de hábitos ya adoptados:', myHabitKeys.size);

    // 🔧 PASO 4: Obtener hábitos disponibles en mis grupos (creados por otros)
    const { data: availableHabits, error: availableError } = await supabase
      .from('habits')
      .select(`
        id,
        name,
        description,
        allow_rest_days,
        rest_days_per_week,
        user_id,
        group_id,
        created_at,
        groups (
          id,
          name,
          description
        ),
        profiles:user_id (
          username,
          full_name
        )
      `)
      .in('group_id', groupIds)
      .neq('user_id', user.id)  // No incluir mis propios hábitos
      .eq('is_active', true)
      .order('created_at', { ascending: false }); // Más recientes primero

    if (availableError) {
      console.error('🔍 Error cargando hábitos disponibles:', availableError);
      setAvailableSharedHabits([]);
      return;
    }

    console.log('🔍 Hábitos disponibles en grupos:', availableHabits?.length || 0);

    // 🔧 PASO 5: Filtrar hábitos que NO he adoptado aún
    const filteredHabits = (availableHabits || []).filter(habit => {
      const habitKey = `${habit.group_id}-${habit.name}`;
      const isAlreadyAdopted = myHabitKeys.has(habitKey);
      
      if (isAlreadyAdopted) {
        console.log(`🔍 FILTRADO: "${habit.name}" ya adoptado`);
      } else {
        console.log(`🔍 DISPONIBLE: "${habit.name}" del grupo ${habit.groups?.name}`);
      }
      
      return !isAlreadyAdopted;
    });

    console.log('🔍 Hábitos finales disponibles para adoptar:', filteredHabits.length);
    
    setAvailableSharedHabits(filteredHabits);
    console.log('🔍 === FIN CARGA DE HÁBITOS DISPONIBLES ===');

  } catch (error) {
    console.error('🔍 Error inesperado:', error);
    setAvailableSharedHabits([]);
  } finally {
    setLoadingAvailableHabits(false);
  }
};

// Reemplazar adoptSharedHabit con esta versión que actualiza correctamente
const adoptSharedHabit = async (sharedHabit) => {
  console.log('📥 Adoptando hábito compartido:', sharedHabit.name);

  try {
    // 🔧 CREAR COPIA DEL HÁBITO PARA EL USUARIO ACTUAL
    const adoptedHabitData = {
      name: sharedHabit.name,
      description: sharedHabit.description,
      allow_rest_days: sharedHabit.allow_rest_days,
      rest_days_per_week: sharedHabit.rest_days_per_week,
      user_id: user.id, // El usuario actual se convierte en propietario
      group_id: sharedHabit.group_id, // Mantiene la referencia al grupo
      is_active: true
    };

    console.log('📥 Datos del hábito a adoptar:', adoptedHabitData);

    const { data: newHabit, error } = await supabase
      .from('habits')
      .insert(adoptedHabitData)
      .select(`
        *,
        groups (
          id,
          name,
          description
        )
      `)
      .single();

    if (error) {
      console.error('📥 Error al adoptar hábito:', error);
      Alert.alert('Error', 'No se pudo adoptar el hábito. Intenta nuevamente.');
      return;
    }

    console.log('📥 Hábito adoptado exitosamente:', newHabit);

    // 🔧 MOSTRAR CONFIRMACIÓN
    Alert.alert(
      'Hábito Adoptado',
      `¡Genial! Ahora estás siguiendo "${sharedHabit.name}" junto con tu grupo "${sharedHabit.groups.name}".`,
      [{ text: '¡Awesome!', style: 'default' }]
    );

    // 🔧 ACTUALIZAR AMBAS LISTAS
    // 1. Añadir a la lista de hábitos del usuario
    const initialStats = await calculateHabitStats(newHabit.id);
    const newHabitWithStats = {
      ...newHabit,
      ...initialStats,
      isShared: true
    };
    
    setHabits(currentHabits => [newHabitWithStats, ...currentHabits]);

    // 2. Remover de la lista de hábitos disponibles
    setAvailableSharedHabits(currentAvailable => 
      currentAvailable.filter(h => 
        !(h.group_id === sharedHabit.group_id && h.name === sharedHabit.name)
      )
    );

    console.log('📥 Listas actualizadas correctamente');

  } catch (error) {
    console.error('📥 Error inesperado al adoptar hábito:', error);
    Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
  }
};

// Añadir esta función después de adoptSharedHabit
const refreshAvailableHabits = async () => {
  console.log('🔄 Refrescando lista de hábitos disponibles...');
  await loadAvailableSharedHabits();
};

// Modificar el useEffect existente para refrescar automáticamente
// Buscar el useEffect que tiene loadUserHabits() y loadAvailableSharedHabits()
// y reemplazarlo con este:

useEffect(() => {
  if (user) {
    loadUserHabits();
    loadAvailableSharedHabits();
    
    // 🔧 REFRESCAR HÁBITOS DISPONIBLES CADA 30 SEGUNDOS
    const intervalId = setInterval(() => {
      console.log('🔄 Refresco automático de hábitos disponibles...');
      loadAvailableSharedHabits();
    }, 30000); // 30 segundos

    dailyCheckIntervalRef.current = setInterval(() => {
      checkAndHandleDayReset();
    }, 60 * 1000);
    
    console.log('🕒 Sistema de verificación diaria configurado');

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (dailyCheckIntervalRef.current) {
        clearInterval(dailyCheckIntervalRef.current);
        console.log('🧹 Sistema de verificación diaria limpiado');
      }
      
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }
}, [user]);

  const showSharedHabitDetails = (sharedHabit) => {
    const creator = sharedHabit.profiles?.full_name || sharedHabit.profiles?.username || 'Miembro del grupo';
    
    Alert.alert(
      `${sharedHabit.name}`,
      `Creado por: ${creator}\nGrupo: ${sharedHabit.groups.name}\n\nDescripción: ${sharedHabit.description || 'Sin descripción'}\n\n¿Te gustaría adoptar este hábito y empezar a seguirlo junto con tu grupo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Adoptar Hábito', 
          style: 'default',
          onPress: () => adoptSharedHabit(sharedHabit)
        }
      ]
    );
  };

  // =====================================================
  // ⚙️ SECCIÓN 10: EFECTOS Y CONFIGURACIÓN INICIAL
  // =====================================================

  useEffect(() => {
    if (user) {
      loadUserHabits();
      loadAvailableSharedHabits();
      
      dailyCheckIntervalRef.current = setInterval(() => {
        checkAndHandleDayReset();
      }, 60 * 1000);
      
      console.log('🕒 Sistema de verificación diaria configurado');
    }

    return () => {
      if (dailyCheckIntervalRef.current) {
        clearInterval(dailyCheckIntervalRef.current);
        console.log('🧹 Sistema de verificación diaria limpiado');
      }
      
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, [user]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App volvió al primer plano, verificando cambio de día...');
        checkAndHandleDayReset();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    checkAndHandleDayReset();
  };

  // =====================================================
  // 🎨 SECCIÓN 11: RENDERIZADO DE LA INTERFAZ
  // =====================================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando tus hábitos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Hábitos</Text>
        <Text style={styles.subtitle}>
          {habits.filter(h => h.isCompleted).length} de {habits.length} completados hoy
        </Text>
      </View>

      {motivationalMessage ? (
        <Animated.View 
          style={[
            styles.messageContainer,
            {
              opacity: messageOpacity,
              transform: [{
                scale: celebrationAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.05]
                })
              }]
            }
          ]}
        >
          <Text style={styles.messageText}>{motivationalMessage}</Text>
        </Animated.View>
      ) : null}

      <ScrollView 
        style={styles.habitsContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3498db']}
            tintColor="#3498db"
          />
        }
      >
        {habits.map(habit => (
          <View key={habit.id} style={styles.habitCard}>
            <View style={styles.habitHeader}>
              <View style={styles.habitInfo}>
                <View style={styles.habitNameContainer}>
                  <Text style={styles.habitName}>{habit.name}</Text>
                  {habit.isShared && (
                    <View style={styles.sharedIndicator}>
                      <Text style={styles.sharedIndicatorText}>👥</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.habitDescription}>
                  {habit.description}
                  {habit.isShared && habit.groups && (
                    <Text style={styles.groupInfo}> • Compartido en "{habit.groups.name}"</Text>
                  )}
                </Text>
              </View>
              
              <View style={styles.habitActions}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>Nv. {habit.level}</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.optionsButton}
                  onPress={() => showHabitOptions(habit)}
                >
                  <Text style={styles.optionsButtonText}>⋮</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{habit.currentStreak}</Text>
                <Text style={styles.statLabel}>Días seguidos</Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[
                  styles.statNumber, 
                  { color: habit.currentStreak > habit.bestStreak ? '#e74c3c' : '#7f8c8d' }
                ]}>
                  {habit.bestStreak}
                </Text>
                <Text style={styles.statLabel}>Mejor racha</Text>
              </View>

              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{habit.totalCompletions}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>
                Progreso: {habit.experience % 100}/100 XP
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(habit.experience % 100)}%` }
                  ]} 
                />
              </View>
            </View>

            {habit.allow_rest_days && (
              <View style={styles.restDaysInfo}>
                <Text style={styles.restDaysText}>
                  📅 Permite {habit.rest_days_per_week} días de descanso por semana
                </Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (habit.isCompleted || habit.hasRestDay) && styles.completedButton
                ]}
                onPress={() => completeHabit(habit.id)}
                disabled={habit.isCompleted || habit.hasRestDay}
              >
                <Text style={[
                  styles.buttonText,
                  (habit.isCompleted || habit.hasRestDay) && styles.completedButtonText
                ]}>
                  {habit.isCompleted ? '✅ Completado hoy' : 
                   habit.hasRestDay ? '😴 Día de descanso' : 
                   '🎯 Completar'}
                </Text>
              </TouchableOpacity>

              {habit.allow_rest_days && !habit.isCompleted && !habit.hasRestDay && (
                <TouchableOpacity
                  style={styles.restButton}
                  onPress={() => markRestDay(habit.id)}
                >
                  <Text style={styles.restButtonText}>😴 Día de descanso</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {availableSharedHabits.length > 0 && (
          <View style={styles.availableHabitsSection}>
            <Text style={styles.availableHabitsTitle}>🌟 Disponibles en Tus Grupos</Text>
            <Text style={styles.availableHabitsSubtitle}>
              Hábitos que puedes adoptar de tus grupos
            </Text>
            
            {availableSharedHabits.map((habit) => (
              <TouchableOpacity 
                key={`${habit.group_id}-${habit.id}`} 
                style={styles.availableHabitCard}
                onPress={() => showSharedHabitDetails(habit)}
                activeOpacity={0.7}
              >
                <View style={styles.availableHabitHeader}>
                  <View style={styles.availableHabitInfo}>
                    <Text style={styles.availableHabitName}>{habit.name}</Text>
                    <Text style={styles.availableHabitGroup}>
                      📍 {habit.groups.name}
                    </Text>
                  </View>
                  <View style={styles.adoptButton}>
                    <Text style={styles.adoptButtonText}>+ Adoptar</Text>
                  </View>
                </View>
                
                {habit.description && (
                  <Text style={styles.availableHabitDescription}>
                    {habit.description}
                  </Text>
                )}
                
                <Text style={styles.availableHabitCreator}>
                  Creado por: {habit.profiles?.full_name || habit.profiles?.username || 'Miembro del grupo'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {availableSharedHabits.length === 0 && !loadingAvailableHabits && habits.length > 0 && (
          <View style={styles.noAvailableHabitsContainer}>
            <Text style={styles.noAvailableHabitsText}>
              💡 Cuando los administradores de tus grupos creen hábitos compartidos, aparecerán aquí para que puedas adoptarlos
            </Text>
          </View>
        )}

        {loadingAvailableHabits && (
          <View style={styles.loadingAvailableContainer}>
            <Text style={styles.loadingAvailableText}>Buscando hábitos disponibles...</Text>
          </View>
        )}
      </ScrollView>

      <DraggableFloatingButton onPress={openCreateHabitModal} />

      <HabitManagementModal
        visible={showManagementModal}
        onClose={closeManagementModal}
        onSave={handleHabitSaved}
        editingHabit={editingHabit}
      />
    </View>
  );
}

// =====================================================
// 🎨 SECCIÓN 12: ESTILOS DE LA INTERFAZ
// =====================================================
// Los estilos van al final del archivo para no interrumpir la lógica del componente

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 18,
    color: '#7f8c8d',
    marginTop: 10,
  },
  messageContainer: {
    backgroundColor: '#e8f5e8',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#27ae60',
  },
  messageText: {
    fontSize: 16,
    color: '#27ae60',
    fontWeight: '600',
    textAlign: 'center',
  },
  habitsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  habitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  habitInfo: {
    flex: 1,
  },
  habitNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  habitName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  sharedIndicator: {
    marginLeft: 8,
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sharedIndicatorText: {
    fontSize: 12,
  },
  habitDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  groupInfo: {
    color: '#27ae60',
    fontStyle: 'italic',
    fontSize: 12,
  },
  habitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  optionsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ecf0f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsButtonText: {
    fontSize: 18,
    color: '#7f8c8d',
    fontWeight: 'bold',
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: 15,
  },
  progressLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498db',
    borderRadius: 4,
  },
  restDaysInfo: {
    backgroundColor: '#fff3e0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  restDaysText: {
    fontSize: 12,
    color: '#f39c12',
    textAlign: 'center',
  },
  actionButtons: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  completedButton: {
    backgroundColor: '#27ae60',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completedButtonText: {
    color: '#ffffff',
  },
  restButton: {
    backgroundColor: '#f39c12',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  restButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  availableHabitsSection: {
    marginTop: 30,
    marginBottom: 20,
  },
  availableHabitsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 5,
    textAlign: 'center',
  },
  availableHabitsSubtitle: {
    fontSize: 14,
    color: '#e67e22',
    textAlign: 'center',
    marginBottom: 15,
  },
  availableHabitCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#f39c12',
    borderStyle: 'dashed',
  },
  availableHabitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  availableHabitInfo: {
    flex: 1,
  },
  availableHabitName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d68910',
  },
  availableHabitGroup: {
    fontSize: 12,
    color: '#b7950b',
    marginTop: 2,
  },
  adoptButton: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  adoptButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  availableHabitDescription: {
    fontSize: 14,
    color: '#a6721b',
    marginBottom: 8,
    lineHeight: 18,
  },
  availableHabitCreator: {
    fontSize: 11,
    color: '#85651d',
    fontStyle: 'italic',
  },
  noAvailableHabitsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  noAvailableHabitsText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  loadingAvailableContainer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  loadingAvailableText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
});