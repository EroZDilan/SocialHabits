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
  RefreshControl
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import HabitManagementModal from '../components/HabitManagementModal';
import DraggableFloatingButton from '../components/DraggableFloatingButton'; 

const { width, height } = Dimensions.get('window');

export default function HabitsScreen() {
  // Accedemos al usuario autenticado desde nuestro contexto de autenticación
  // Esto nos permite asociar todos los hábitos con el usuario específico
  const { user } = useAuth();
  
  // Estados para manejar los datos de hábitos que vienen de la base de datos
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para animaciones y mensajes motivacionales (conservamos la funcionalidad existente)
  const [celebrationAnim] = useState(new Animated.Value(0));
  const [motivationalMessage, setMotivationalMessage] = useState('');
  const [messageOpacity] = useState(new Animated.Value(0));
  const messageTimeoutRef = useRef(null);

  const [availableSharedHabits, setAvailableSharedHabits] = useState([]);
const [loadingAvailableHabits, setLoadingAvailableHabits] = useState(false);
  const [showManagementModal, setShowManagementModal] = useState(false);
const [editingHabit, setEditingHabit] = useState(null);
const [deletingHabitId, setDeletingHabitId] = useState(null);


  // Después de todos los useState y useRef, pero antes de cualquier otra función
// Colocar estas funciones utilitarias primero asegura que estén disponibles para todas las demás

// Función para calcular nivel basándose en experiencia (función base)
const calculateLevel = (experience) => {
  return Math.floor(experience / 100) + 1;
};

// Función para calcular experiencia ganada basándose en la racha actual
// Esta función implementa el sistema de recompensas progresivas
const calculateExperienceGained = (currentStreak) => {
  let baseExperience = 10; // Experiencia base por completar cualquier hábito
  let streakBonus = 0; // Bonificación adicional por mantener rachas
  
  if (currentStreak >= 7) {
    streakBonus += 5; // Bonificación por primera semana completa
  }
  
  if (currentStreak >= 14) {
    streakBonus += 10; // Bonificación adicional por dos semanas
  }
  
  if (currentStreak >= 30) {
    streakBonus += 20; // Bonificación mayor por un mes completo
  }
  
  // Para rachas muy largas, añadimos una bonificación proporcional
  if (currentStreak > 30) {
    streakBonus += Math.floor((currentStreak - 30) / 7) * 5;
  }
  
  return baseExperience + streakBonus;
};

// Función que genera mensajes motivacionales contextuales
const generateMotivationalMessage = (habit, isNewRecord = false) => {
  const messages = {
    short: [
      `¡Genial! Ya llevas ${habit.currentStreak} días con ${habit.name}. ¡Cada día cuenta!`,
      `¡Fantástico! ${habit.currentStreak} días consecutivos. ¡Estás construyendo algo grande!`,
      `¡Increíble! Ya van ${habit.currentStreak} días. ¡El momentum está de tu lado!`
    ],
    medium: [
      `¡WOW! ${habit.currentStreak} días seguidos con ${habit.name}. ¡Eres imparable!`,
      `¡Impresionante! ${habit.currentStreak} días de constancia. ¡Esto ya es un hábito real!`,
      `¡Brutal! ${habit.currentStreak} días consecutivos. ¡Tu disciplina es admirable!`
    ],
    long: [
      `¡ÉPICO! ${habit.currentStreak} días seguidos. ¡Eres una máquina de hábitos!`,
      `¡LEYENDA! ${habit.currentStreak} días consecutivos con ${habit.name}. ¡Esto es pura disciplina!`,
      `¡CAMPEÓN! ${habit.currentStreak} días sin parar. ¡Tu futuro yo te lo agradecerá!`
    ],
    record: [
      `🏆 ¡NUEVO RÉCORD! ${habit.currentStreak} días. ¡Superaste tu marca anterior de ${habit.bestStreak} días!`,
      `🎉 ¡RÉCORD PERSONAL! ${habit.currentStreak} días consecutivos. ¡Eres oficialmente imparable!`
    ]
  };

  if (isNewRecord) {
    return messages.record[Math.floor(Math.random() * messages.record.length)];
  }

  let category;
  if (habit.currentStreak <= 5) {
    category = messages.short;
  } else if (habit.currentStreak <= 15) {
    category = messages.medium;
  } else {
    category = messages.long;
  }

  return category[Math.floor(Math.random() * category.length)];
};

// Función que maneja el ciclo completo de vida de los mensajes motivacionales
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

// Función que ejecuta la animación de celebración
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
// Función para abrir el modal en modo de creación de nuevo hábito
// Esta función prepara el modal para crear un hábito completamente nuevo
const openCreateHabitModal = () => {
  console.log('Abriendo modal para crear nuevo hábito');
  setEditingHabit(null); // Aseguramos que no hay hábito en edición
  setShowManagementModal(true);
};

// Función para abrir el modal en modo de edición de hábito existente
// Esta función prepara el modal con los datos del hábito a editar
const openEditHabitModal = (habit) => {
  console.log('Abriendo modal para editar hábito:', habit.name);
  setEditingHabit(habit); // Establecemos el hábito que se va a editar
  setShowManagementModal(true);
};

// Función para cerrar el modal y limpiar estados relacionados
const closeManagementModal = () => {
  console.log('Cerrando modal de gestión');
  setShowManagementModal(false);
  setEditingHabit(null); // Limpiamos el estado de edición
};

// Función callback que se ejecuta cuando el modal guarda exitosamente un hábito
// Esta función actualiza la lista local sin necesidad de recargar desde la base de datos
const handleHabitSaved = async (savedHabit) => {
  console.log('Hábito guardado exitosamente:', savedHabit.name);
  
  try {
    // Si estamos editando un hábito existente, actualizamos ese hábito en la lista
    if (editingHabit) {
      console.log('Actualizando hábito existente en la lista local');
      
      // Recalculamos las estadísticas del hábito editado para asegurar consistencia
      const updatedStats = await calculateHabitStats(savedHabit.id);
      
      setHabits(currentHabits => {
        return currentHabits.map(habit => {
          if (habit.id === savedHabit.id) {
            // Combinamos los datos guardados con las estadísticas recalculadas
            return {
              ...savedHabit,
              ...updatedStats
            };
          }
          return habit;
        });
      });
    } else {
      // Si estamos creando un nuevo hábito, lo añadimos a la lista
      console.log('Añadiendo nuevo hábito a la lista local');
      
      // Calculamos las estadísticas iniciales para el nuevo hábito
      const initialStats = await calculateHabitStats(savedHabit.id);
      
      const newHabitWithStats = {
        ...savedHabit,
        ...initialStats
      };
      
      setHabits(currentHabits => [newHabitWithStats, ...currentHabits]);
    }
  } catch (error) {
    console.error('Error al actualizar la lista local después de guardar:', error);
    // Si hay error actualizando localmente, recargamos toda la lista desde la base de datos
    await loadUserHabits();
  }
};

// Función para manejar la eliminación de hábitos con confirmación y eliminación suave
// La eliminación suave preserva los datos históricos mientras oculta el hábito de la vista activa
const handleDeleteHabit = (habit) => {
  console.log('Iniciando eliminación de hábito:', habit.name);
  
  // Mostramos una confirmación detallada que explica las consecuencias de la eliminación
  Alert.alert(
    'Eliminar Hábito',
    `¿Estás seguro de que quieres eliminar "${habit.name}"?\n\nEsto ocultará el hábito de tu lista, pero conservará tu historial de progreso para futuras consultas.`,
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

// Función que ejecuta la eliminación suave después de la confirmación del usuario
const confirmDeleteHabit = async (habit) => {
  console.log('Ejecutando eliminación suave para:', habit.name);
  setDeletingHabitId(habit.id); // Marcamos que está en proceso de eliminación para UI feedback
  
  try {
    // Realizamos eliminación suave marcando el hábito como inactivo en lugar de borrarlo
    const { error } = await supabase
      .from('habits')
      .update({ is_active: false })
      .eq('id', habit.id)
      .eq('user_id', user.id); // Verificación adicional de seguridad

    if (error) {
      console.error('Error al eliminar hábito:', error);
      Alert.alert('Error', 'No se pudo eliminar el hábito. Intenta nuevamente.');
      return;
    }

    console.log('Hábito eliminado exitosamente de la base de datos');

    // Removemos el hábito de la lista local inmediatamente para feedback visual rápido
    setHabits(currentHabits => {
      return currentHabits.filter(h => h.id !== habit.id);
    });

    // Mostramos confirmación al usuario con opción de deshacer (implementaremos esto más adelante)
    Alert.alert(
      'Hábito Eliminado',
      `"${habit.name}" ha sido eliminado exitosamente.`,
      [{ text: 'OK', style: 'default' }]
    );

  } catch (error) {
    console.error('Error inesperado al eliminar hábito:', error);
    Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
  } finally {
    setDeletingHabitId(null); // Limpiamos el estado de eliminación
  }
};

// Función para mostrar las opciones de gestión para un hábito específico
// Esta función proporciona un menú contextual con todas las acciones disponibles
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

  // Función para cargar todos los hábitos del usuario desde la base de datos
  // Esta función maneja tanto la carga inicial como las actualizaciones posteriores
  // Función para cargar todos los hábitos del usuario desde la base de datos
// Esta versión incluye logging extensivo para diagnosticar problemas de conectividad
const loadUserHabits = async () => {
  if (!user) {
    console.log('No hay usuario autenticado, no se pueden cargar hábitos');
    return;
  }

  try {
    console.log('Cargando hábitos para el usuario:', user.email);
    
    // Primero cargamos los hábitos personales del usuario (sin group_id)
    console.log('📱 Cargando hábitos personales...');
    const { data: personalHabits, error: personalError } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .is('group_id', null) // Hábitos que no están asignados a ningún grupo
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (personalError) {
      console.error('Error al cargar hábitos personales:', personalError);
      Alert.alert('Error', 'No se pudieron cargar tus hábitos personales. Intenta nuevamente.');
      return;
    }

    console.log(`📱 Hábitos personales cargados: ${personalHabits?.length || 0}`);

    // Ahora cargamos los hábitos compartidos de todos los grupos donde el usuario es miembro
    console.log('👥 Cargando hábitos compartidos de grupos...');
    const { data: sharedHabits, error: sharedError } = await supabase
      .from('habits')
      .select(`
        *,
        groups (
          id,
          name,
          description
        )
      `)
      .not('group_id', 'is', null) // Hábitos que SÍ están asignados a grupos
      .eq('is_active', true)
      .in('group_id', await getUserGroupIds()) // Solo grupos donde el usuario es miembro
      .order('created_at', { ascending: false });

    if (sharedError) {
      console.error('Error al cargar hábitos compartidos:', sharedError);
      // Los hábitos compartidos son opcionales, así que continuamos con solo los personales
      console.log('Continuando solo con hábitos personales...');
    }

    console.log(`👥 Hábitos compartidos cargados: ${sharedHabits?.length || 0}`);

    // Combinamos ambos tipos de hábitos en una sola lista
    const allHabits = [
      ...(personalHabits || []).map(habit => ({ ...habit, isShared: false })),
      ...(sharedHabits || []).map(habit => ({ ...habit, isShared: true }))
    ];

    console.log(`📊 Total de hábitos combinados: ${allHabits.length}`);

    // Si no hay hábitos en absoluto, creamos algunos hábitos de ejemplo personales
    if (allHabits.length === 0) {
      console.log('No se encontraron hábitos, creando hábitos de ejemplo...');
      await createDefaultHabits();
      return; // createDefaultHabits llamará a loadUserHabits nuevamente
    }

    // Para cada hábito, calculamos las estadísticas dinámicas
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
    const { data: memberships, error } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error al obtener IDs de grupos:', error);
      return []; // Retornamos array vacío si hay error
    }

    const groupIds = memberships?.map(m => m.group_id) || [];
    console.log(`👥 Usuario es miembro de ${groupIds.length} grupos:`, groupIds);
    return groupIds;

  } catch (error) {
    console.error('Error inesperado al obtener IDs de grupos:', error);
    return [];
  }
};

  // Función para crear hábitos de ejemplo cuando un usuario nuevo no tiene ningún hábito
  // Esto proporciona contenido inmediato y demuestra la funcionalidad de la aplicación
  // Función para crear hábitos de ejemplo con logging detallado
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

  console.log('📝 createDefaultHabits: Hábitos a crear:', defaultHabits);

  try {
    console.log('🔄 createDefaultHabits: Insertando en Supabase...');
    
    // Insertamos los hábitos de ejemplo en la base de datos
    const { data, error } = await supabase
      .from('habits')
      .insert(defaultHabits)
      .select();

    console.log('📊 createDefaultHabits: Respuesta de inserción:', data);
    console.log('📊 createDefaultHabits: Error de inserción:', error);

    if (error) {
      console.error('❌ createDefaultHabits: Error al insertar:', error);
      Alert.alert('Error', `No se pudieron crear hábitos de ejemplo: ${error.message}`);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    console.log('✅ createDefaultHabits: Hábitos creados exitosamente, recargando...');
    // Recargamos los hábitos para mostrar los nuevos hábitos con sus estadísticas
    await loadUserHabits();

  } catch (error) {
    console.error('💥 createDefaultHabits: Error inesperado:', error);
    Alert.alert('Error', `Error inesperado: ${error.message}`);
    setLoading(false);
    setRefreshing(false);
  }
};

  // Función para calcular estadísticas dinámicas de un hábito específico
  // Estas estadísticas se calculan en tiempo real basándose en las completaciones actuales
  const calculateHabitStats = async (habitId) => {
    try {
      // Obtenemos todas las completaciones de este hábito para calcular estadísticas
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

      // Obtenemos los días de descanso para considerar en el cálculo de rachas
      const { data: restDays, error: restError } = await supabase
        .from('habit_rest_days')
        .select('rest_date')
        .eq('habit_id', habitId)
        .eq('user_id', user.id);

      if (restError) {
        console.error('Error al obtener días de descanso:', restError);
      }

      // Calculamos las estadísticas basándose en los datos reales
      const today = new Date().toISOString().split('T')[0];
      const isCompletedToday = completions.some(c => c.completed_date === today);
      const currentStreak = calculateCurrentStreak(completions, restDays || []);
      const bestStreak = calculateBestStreak(completions, restDays || []);
      const totalCompletions = completions.length;
      
      // Calculamos experiencia y nivel basándose en completaciones totales y rachas
      const experience = calculateTotalExperience(completions, currentStreak);
      const level = calculateLevel(experience);

      return {
        currentStreak,
        bestStreak,
        totalCompletions,
        experience,
        level,
        isCompleted: isCompletedToday,
        completions: completions.map(c => c.completed_date),
        restDays: (restDays || []).map(r => r.rest_date)
      };

    } catch (error) {
      console.error('Error al calcular estadísticas:', error);
      return getDefaultStats();
    }
  };

  // Función que proporciona estadísticas por defecto cuando hay errores
  const getDefaultStats = () => ({
    currentStreak: 0,
    bestStreak: 0,
    totalCompletions: 0,
    experience: 0,
    level: 1,
    isCompleted: false,
    completions: [],
    restDays: []
  });

  // Función mejorada para calcular la racha actual considerando días de descanso
  // Esta función entiende que los días de descanso no deben romper las rachas
  const calculateCurrentStreak = (completions, restDays) => {
    if (!completions || completions.length === 0) return 0;

    // Convertimos las fechas a objetos Date para facilitar los cálculos
    const completionDates = completions.map(c => new Date(c.completed_date)).sort((a, b) => b - a);
    const restDates = restDays.map(r => new Date(r.rest_date));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let currentDate = new Date(today);

    // Verificamos día por día hacia atrás para calcular la racha consecutiva
    for (let i = 0; i < 365; i++) { // Limitamos a un año para evitar cálculos infinitos
      const dateString = currentDate.toISOString().split('T')[0];
      const hasCompletion = completionDates.some(d => d.getTime() === currentDate.getTime());
      const isRestDay = restDates.some(d => d.getTime() === currentDate.getTime());

      if (hasCompletion) {
        streak++;
      } else if (isRestDay) {
        // Los días de descanso no rompen la racha pero tampoco la incrementan
        // Continuamos verificando días anteriores
      } else {
        // Si no hay completación ni es día de descanso, la racha se rompe
        break;
      }

      // Retrocedemos un día para la siguiente iteración
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  };

  // Función para calcular la mejor racha histórica
  // Examina todas las completaciones para encontrar la secuencia más larga
  const calculateBestStreak = (completions, restDays) => {
    if (!completions || completions.length === 0) return 0;

    // Esta es una implementación simplificada que asume que la racha actual es representativa
    // En una implementación más sofisticada, examinaríamos todos los períodos históricos
    const currentStreak = calculateCurrentStreak(completions, restDays);
    
    // Por ahora, retornamos la racha actual como la mejor racha
    // Esto se puede expandir para analizar períodos históricos específicos
    return Math.max(currentStreak, completions.length > 10 ? Math.floor(completions.length / 3) : 0);
  };

  // Función para calcular experiencia total basándose en completaciones y rachas
  const calculateTotalExperience = (completions, currentStreak) => {
    const baseExperience = completions.length * 10; // 10 puntos por cada completación
    const streakBonus = currentStreak * 5; // 5 puntos adicionales por cada día de racha actual
    return baseExperience + streakBonus;
  };

  // Función para cargar hábitos compartidos disponibles en los grupos del usuario
// que el usuario aún no está siguiendo activamente
const loadAvailableSharedHabits = async () => {
  if (!user) return;

  setLoadingAvailableHabits(true);
  try {
    console.log('🔍 Cargando hábitos compartidos disponibles...');

    // Primero obtenemos los IDs de grupos donde el usuario es miembro
    const { data: userGroups, error: groupsError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (groupsError || !userGroups || userGroups.length === 0) {
      console.log('🔍 Usuario no pertenece a ningún grupo o error al cargar grupos');
      setAvailableSharedHabits([]);
      return;
    }

    const groupIds = userGroups.map(g => g.group_id);
    console.log('🔍 Buscando hábitos en grupos:', groupIds);

    // Obtenemos todos los hábitos compartidos en esos grupos
    const { data: allSharedHabits, error: habitsError } = await supabase
      .from('habits')
      .select(`
        *,
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
      .eq('is_active', true)
      .neq('user_id', user.id); // No incluir hábitos creados por el usuario actual

    if (habitsError) {
      console.error('🔍 Error al cargar hábitos compartidos:', habitsError);
      setAvailableSharedHabits([]);
      return;
    }

    // Obtenemos los hábitos que el usuario ya está siguiendo para filtrarlos
    const { data: userHabits, error: userHabitsError } = await supabase
      .from('habits')
      .select('group_id, name')
      .eq('user_id', user.id)
      .not('group_id', 'is', null);

    if (userHabitsError) {
      console.error('🔍 Error al cargar hábitos del usuario:', userHabitsError);
    }

    // Filtramos hábitos que el usuario ya no está siguiendo
    // Esto evita duplicados y muestra solo nuevas oportunidades
    const userSharedHabits = new Set(
      (userHabits || []).map(h => `${h.group_id}-${h.name}`)
    );

    const availableHabits = (allSharedHabits || []).filter(habit => 
      !userSharedHabits.has(`${habit.group_id}-${habit.name}`)
    );

    console.log(`🔍 Encontrados ${availableHabits.length} hábitos compartidos disponibles`);
    setAvailableSharedHabits(availableHabits);

  } catch (error) {
    console.error('🔍 Error inesperado al cargar hábitos disponibles:', error);
    setAvailableSharedHabits([]);
  } finally {
    setLoadingAvailableHabits(false);
  }
};

// Función para que un usuario adopte un hábito compartido existente
// Esto crea una copia personal del hábito compartido para el usuario
const adoptSharedHabit = async (sharedHabit) => {
  console.log('📥 Adoptando hábito compartido:', sharedHabit.name);

  try {
    // Creamos una copia del hábito compartido para el usuario actual
    const adoptedHabitData = {
      name: sharedHabit.name,
      description: sharedHabit.description,
      allow_rest_days: sharedHabit.allow_rest_days,
      rest_days_per_week: sharedHabit.rest_days_per_week,
      user_id: user.id,
      group_id: sharedHabit.group_id, // Mantiene la conexión al grupo
      is_active: true
    };

    const { data: newHabit, error } = await supabase
      .from('habits')
      .insert(adoptedHabitData)
      .select()
      .single();

    if (error) {
      console.error('📥 Error al adoptar hábito:', error);
      Alert.alert('Error', 'No se pudo adoptar el hábito. Intenta nuevamente.');
      return;
    }

    console.log('📥 Hábito adoptado exitosamente:', newHabit);

    // Mostramos confirmación al usuario
    Alert.alert(
      'Hábito Adoptado',
      `¡Genial! Ahora estás siguiendo "${sharedHabit.name}" junto con tu grupo "${sharedHabit.groups.name}".`,
      [{ text: '¡Awesome!', style: 'default' }]
    );

    // Recargamos los hábitos del usuario y los hábitos disponibles
    await loadUserHabits();
    await loadAvailableSharedHabits();

  } catch (error) {
    console.error('📥 Error inesperado al adoptar hábito:', error);
    Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
  }
};

// Función para mostrar detalles de un hábito compartido antes de adoptarlo
// Esto permite que el usuario tome una decisión informada
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

  // Función principal para completar un hábito con persistencia en la nube
// Esta función implementa actualizaciones optimistas para feedback inmediato
// Función principal para completar un hábito con manejo correcto de estado
// Esta versión usa actualizaciones funcionales para evitar problemas de referencias obsoletas
const completeHabit = async (habitId) => {
  console.log('🎯 completeHabit: Iniciando para habitId:', habitId);
  
  // Usamos una actualización funcional para obtener el estado más reciente
  // Esto asegura que siempre trabajemos con los datos actualizados
  setHabits(currentHabits => {
    console.log('📊 completeHabit: Estado actual de hábitos:', currentHabits.length, 'hábitos');
    
    // Encontramos el hábito específico en el estado más reciente
    const habitToComplete = currentHabits.find(h => h.id === habitId);
    if (!habitToComplete) {
      console.error('❌ completeHabit: Hábito no encontrado en estado actual');
      return currentHabits; // Retornamos el estado sin cambios
    }
    
    // Verificamos que no esté ya completado hoy
    if (habitToComplete.isCompleted) {
      console.log('⚠️ completeHabit: Hábito ya completado hoy');
      return currentHabits; // Retornamos el estado sin cambios
    }

    console.log('📝 completeHabit: Completando hábito:', habitToComplete.name);
    console.log('📈 completeHabit: Racha actual:', habitToComplete.currentStreak);

    // Calculamos los nuevos valores para la actualización optimista
    const newStreak = habitToComplete.currentStreak + 1;
    const experienceGained = calculateExperienceGained(newStreak);
    const newExperience = habitToComplete.experience + experienceGained;
    const newLevel = calculateLevel(newExperience);

    console.log('🎊 completeHabit: Nuevos valores calculados:', {
      newStreak,
      experienceGained,
      newExperience,
      newLevel
    });

    // Creamos el estado actualizado con la actualización optimista
    const updatedHabits = currentHabits.map(habit => {
      if (habit.id === habitId) {
        const updatedHabit = {
          ...habit,
          isCompleted: true,
          currentStreak: newStreak,
          totalCompletions: habit.totalCompletions + 1,
          experience: newExperience,
          level: newLevel
        };
        
        console.log('✨ completeHabit: Hábito actualizado optimistamente:', updatedHabit.name);
        
        // Ejecutamos efectos secundarios después de la actualización optimista
        // Usamos setTimeout para asegurar que se ejecuten después del render
        setTimeout(() => {
          console.log('🎉 completeHabit: Ejecutando efectos de celebración...');
          
          // Ejecutamos la animación de celebración
          celebrateCompletion();
          
          // Determinamos si es un nuevo récord
          const isNewRecord = newStreak > habitToComplete.bestStreak;
          console.log('🏆 completeHabit: ¿Es nuevo récord?', isNewRecord);
          
          // Generamos y mostramos el mensaje motivacional
          const message = generateMotivationalMessage(updatedHabit, isNewRecord);
          console.log('💬 completeHabit: Mensaje generado:', message);
          showMotivationalMessage(message);
          
          // Iniciamos la sincronización con la base de datos en segundo plano
          syncCompletionToDatabase(habitId, updatedHabit);
          
        }, 100); // Pequeño delay para asegurar que el render se complete primero
        
        return updatedHabit;
      }
      return habit;
    });

    console.log('🔄 completeHabit: Retornando estado actualizado');
    return updatedHabits;
  });
};

// Función separada para manejar la sincronización con la base de datos
// Separamos esta lógica para mantener la actualización de estado limpia y rápida
const syncCompletionToDatabase = async (habitId, optimisticHabit) => {
  console.log('💾 syncCompletionToDatabase: Iniciando sincronización para:', habitId);
  
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log('📅 syncCompletionToDatabase: Guardando para fecha:', today);

    // Insertamos la completación en la base de datos
    const { data, error } = await supabase
      .from('habit_completions')
      .insert({
        habit_id: habitId,
        user_id: user.id,
        completed_date: today,
        notes: null
      })
      .select()
      .single();

    if (error) {
      console.error('❌ syncCompletionToDatabase: Error al guardar:', error);
      
      // Si la sincronización falla, revertimos la actualización optimista
      // y notificamos al usuario del problema
      setHabits(currentHabits => {
        return currentHabits.map(habit => {
          if (habit.id === habitId) {
            return {
              ...habit,
              isCompleted: false,
              currentStreak: habit.currentStreak - 1,
              totalCompletions: habit.totalCompletions - 1,
              experience: habit.experience - calculateExperienceGained(habit.currentStreak),
              level: calculateLevel(habit.experience - calculateExperienceGained(habit.currentStreak))
            };
          }
          return habit;
        });
      });
      
      Alert.alert('Error de Sincronización', 'No se pudo guardar tu progreso. Intenta nuevamente.');
      return;
    }

    console.log('✅ syncCompletionToDatabase: Completación guardada exitosamente');

    // Opcional: Recalcular estadísticas reales desde la base de datos
    // Esto asegura que las estadísticas locales coincidan exactamente con la base de datos
    setTimeout(async () => {
      console.log('🧮 syncCompletionToDatabase: Recalculando estadísticas reales...');
      const realStats = await calculateHabitStats(habitId);
      
      setHabits(currentHabits => {
        return currentHabits.map(habit => {
          if (habit.id === habitId) {
            console.log('📊 syncCompletionToDatabase: Actualizando con estadísticas reales');
            return {
              ...habit,
              ...realStats
            };
          }
          return habit;
        });
      });
    }, 1000); // Esperamos un segundo antes de recalcular para evitar múltiples actualizaciones rápidas

  } catch (error) {
    console.error('💥 syncCompletionToDatabase: Error inesperado:', error);
    Alert.alert('Error', 'Ocurrió un error inesperado durante la sincronización.');
  }
};

// Función para marcar un día como día de descanso con persistencia
// Esta función mantiene las rachas mientras reconoce que algunos hábitos requieren flexibilidad
const markRestDay = async (habitId) => {
  console.log('😴 markRestDay: Iniciando para habitId:', habitId);

  // Encontramos el hábito específico
  const habitToRest = habits.find(h => h.id === habitId);
  if (!habitToRest) {
    console.error('❌ markRestDay: Hábito no encontrado');
    return;
  }

  // Verificamos que el hábito permita días de descanso
  if (!habitToRest.allow_rest_days) {
    Alert.alert('No Permitido', 'Este hábito no permite días de descanso planificados.');
    return;
  }

  console.log('📝 markRestDay: Marcando día de descanso para:', habitToRest.name);

  // Mostramos confirmación para asegurar que es una decisión consciente
  // Los días de descanso deben ser decisiones deliberadas, no escapes fáciles
  Alert.alert(
    '¿Día de descanso?',
    `¿Estás seguro de que quieres marcar hoy como día de descanso para ${habitToRest.name}? Esto mantendrá tu racha activa.`,
    [
      {
        text: 'Cancelar',
        style: 'cancel',
        onPress: () => console.log('😴 markRestDay: Cancelado por el usuario')
      },
      {
        text: 'Sí, es descanso',
        onPress: async () => {
          try {
            const today = new Date().toISOString().split('T')[0];
            console.log('💾 markRestDay: Guardando día de descanso en la base de datos para fecha:', today);

            // Insertamos el día de descanso en la base de datos
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
              console.error('❌ markRestDay: Error al guardar día de descanso:', error);
              
              // Manejamos el caso específico donde ya existe un registro para hoy
              if (error.code === '23505') { // Violación de constraint único
                Alert.alert('Ya Registrado', 'Ya has marcado hoy como día de descanso para este hábito.');
              } else {
                Alert.alert('Error', 'No se pudo registrar el día de descanso. Intenta nuevamente.');
              }
              return;
            }

            console.log('✅ markRestDay: Día de descanso guardado exitosamente:', data);

            // Recalculamos estadísticas para reflejar el día de descanso
            console.log('🧮 markRestDay: Recalculando estadísticas...');
            const updatedStats = await calculateHabitStats(habitId);
            console.log('📊 markRestDay: Estadísticas actualizadas:', updatedStats);

            // Actualizamos el estado con las nuevas estadísticas
            const updatedHabits = habits.map(habit => {
              if (habit.id === habitId) {
                return {
                  ...habit,
                  ...updatedStats
                };
              }
              return habit;
            });

            setHabits(updatedHabits);

            // Mostramos mensaje específico para días de descanso
            const restMessage = `😴 Día de descanso registrado para ${habitToRest.name}. ¡El descanso también es parte del progreso! Tu racha de ${updatedStats.currentStreak} días se mantiene.`;
            showMotivationalMessage(restMessage);
            console.log('🎉 markRestDay: Mensaje de descanso mostrado');

          } catch (error) {
            console.error('💥 markRestDay: Error inesperado:', error);
            Alert.alert('Error', 'Ocurrió un error inesperado. Intenta nuevamente.');
          }
        },
      },
    ]
  );
};

  // Función para calcular nivel basándose en experiencia (conservamos la lógica original)


  // Efecto que carga los hábitos cuando el componente se monta o cuando cambia el usuario
  useEffect(() => {
    if (user) {
      loadUserHabits();
      loadAvailableSharedHabits(); 
    }
  }, [user]);

  // Función para manejar el pull-to-refresh (deslizar hacia abajo para actualizar)
  const onRefresh = () => {
    setRefreshing(true);
    loadUserHabits();
    loadAvailableSharedHabits(); 
  };

  // Conservamos todas las funciones de mensajes motivacionales y animaciones de la implementación anterior
  

  

  // Si estamos cargando datos iniciales, mostramos un indicador de carga
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando tus hábitos...</Text>
      </View>
    );
  }

  // Renderizado principal con pull-to-refresh habilitado
  return (
  <View style={styles.container}>
    {/* Header con información general del usuario y estadísticas del día */}
    <View style={styles.header}>
      <Text style={styles.title}>Mis Hábitos</Text>
      <Text style={styles.subtitle}>
        {habits.filter(h => h.isCompleted).length} de {habits.length} completados hoy
      </Text>
    </View>

    {/* Mensaje motivacional con animaciones cuando aparece después de completar hábitos */}
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

    {/* Lista scrolleable de hábitos con funcionalidad de pull-to-refresh */}
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
  {/* Sección principal de hábitos del usuario */}
  {habits.map(habit => (
    <View key={habit.id} style={styles.habitCard}>
      {/* Header del hábito con nombre, descripción, nivel y botón de opciones */}
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
        
        {/* Nueva sección que agrupa el badge de nivel y el botón de opciones */}
        <View style={styles.habitActions}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Nv. {habit.level}</Text>
          </View>
          
          {/* Botón de opciones para editar y eliminar hábitos */}
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => showHabitOptions(habit)}
          >
            <Text style={styles.optionsButtonText}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Estadísticas principales del hábito - racha, mejor racha, total */}
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

      {/* Barra de progreso hacia el siguiente nivel con experiencia actual */}
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

      {/* Información sobre días de descanso si el hábito los permite */}
      {habit.allow_rest_days && (
        <View style={styles.restDaysInfo}>
          <Text style={styles.restDaysText}>
            📅 Permite {habit.rest_days_per_week} días de descanso por semana
          </Text>
        </View>
      )}

      {/* Botones de acción para completar hábito y marcar día de descanso */}
      <View style={styles.actionButtons}>
        {/* Botón principal para completar el hábito - cambia apariencia cuando está completado */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            habit.isCompleted && styles.completedButton
          ]}
          onPress={() => completeHabit(habit.id)}
          disabled={habit.isCompleted}
        >
          <Text style={[
            styles.buttonText,
            habit.isCompleted && styles.completedButtonText
          ]}>
            {habit.isCompleted ? '✅ Completado hoy' : '🎯 Completar'}
          </Text>
        </TouchableOpacity>

        {/* Botón de día de descanso - solo aparece para hábitos que lo permiten y no están completados */}
        {habit.allow_rest_days && !habit.isCompleted && (
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

  {/* Sección de hábitos compartidos disponibles - NUEVA FUNCIONALIDAD */}
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

  {/* Mensaje informativo cuando no hay hábitos disponibles pero el usuario tiene grupos */}
  {availableSharedHabits.length === 0 && !loadingAvailableHabits && habits.length > 0 && (
    <View style={styles.noAvailableHabitsContainer}>
      <Text style={styles.noAvailableHabitsText}>
        💡 Cuando los administradores de tus grupos creen hábitos compartidos, aparecerán aquí para que puedas adoptarlos
      </Text>
    </View>
  )}

  {/* Indicador de carga para hábitos disponibles */}
  {loadingAvailableHabits && (
    <View style={styles.loadingAvailableContainer}>
      <Text style={styles.loadingAvailableText}>Buscando hábitos disponibles...</Text>
    </View>
  )}
</ScrollView>

    {/* Botón flotante arrastrable para crear nuevos hábitos */}
<DraggableFloatingButton onPress={openCreateHabitModal} />

    {/* Modal de gestión de hábitos que maneja tanto creación como edición */}
    <HabitManagementModal
      visible={showManagementModal}
      onClose={closeManagementModal}
      onSave={handleHabitSaved}
      editingHabit={editingHabit}
    />
  </View>
);
}

// Conservamos todos los estilos de la implementación anterior
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
  habitName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  habitDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
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
  // Añadir estos estilos al objeto styles existente
habitActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
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
// Añadir estos estilos al objeto styles existente
habitNameContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 2,
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
groupInfo: {
  color: '#27ae60',
  fontStyle: 'italic',
  fontSize: 12,
},
// Estilos para la sección de hábitos disponibles
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
// Estilos adicionales para elementos informativos
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