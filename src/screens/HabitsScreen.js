import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Animated,
  Dimensions
} from 'react-native';

// Importamos Dimensions para obtener las medidas de la pantalla
// Esto nos permitirá crear animaciones que se adapten a diferentes tamaños de dispositivo
const { width, height } = Dimensions.get('window');

export default function HabitsScreen() {
  // Este hook maneja la lista de hábitos del usuario
  // Cada hábito tendrá múltiples propiedades que rastrean su estado completo
  const [habits, setHabits] = useState([
    {
      id: 1,
      name: 'Ejercicio',
      description: 'Actividad física diaria',
      currentStreak: 5, // Días consecutivos actuales
      bestStreak: 12, // Mejor racha histórica
      allowRestDays: true, // Si permite días de descanso planificados
      restDaysPerWeek: 2, // Cuántos días de descanso por semana
      completions: [], // Array de fechas cuando se completó
      restDays: [], // Array de fechas marcadas como descanso
      totalCompletions: 23, // Total histórico de completaciones
      level: 3, // Nivel basado en completaciones totales
      experience: 230, // Puntos de experiencia
      isCompleted: false // Si está completado hoy
    },
    {
      id: 2,
      name: 'Leer',
      description: '30 minutos de lectura',
      currentStreak: 8,
      bestStreak: 15,
      allowRestDays: false, // La lectura puede hacerse todos los días
      restDaysPerWeek: 0,
      completions: [],
      restDays: [],
      totalCompletions: 45,
      level: 4,
      experience: 450,
      isCompleted: true // Ya completado hoy
    },
    {
      id: 3,
      name: 'Ejercicio',
      description: 'Actividad física diaria',
      currentStreak: 5, // Días consecutivos actuales
      bestStreak: 12, // Mejor racha histórica
      allowRestDays: true, // Si permite días de descanso planificados
      restDaysPerWeek: 2, // Cuántos días de descanso por semana
      completions: [], // Array de fechas cuando se completó
      restDays: [], // Array de fechas marcadas como descanso
      totalCompletions: 23, // Total histórico de completaciones
      level: 3, // Nivel basado en completaciones totales
      experience: 230, // Puntos de experiencia
      isCompleted: false // Si está completado hoy
    },
    {
      id: 4,
      name: 'Ejercicio',
      description: 'Actividad física diaria',
      currentStreak: 5, // Días consecutivos actuales
      bestStreak: 12, // Mejor racha histórica
      allowRestDays: true, // Si permite días de descanso planificados
      restDaysPerWeek: 2, // Cuántos días de descanso por semana
      completions: [], // Array de fechas cuando se completó
      restDays: [], // Array de fechas marcadas como descanso
      totalCompletions: 23, // Total histórico de completaciones
      level: 3, // Nivel basado en completaciones totales
      experience: 230, // Puntos de experiencia
      isCompleted: false // Si está completado hoy
    },
  ]);

  // Este estado controla las animaciones de celebración
  // Usaremos Animated.Value para crear transiciones suaves
  const [celebrationAnim] = useState(new Animated.Value(0));
  // Este estado guarda el mensaje motivacional actual
const [motivationalMessage, setMotivationalMessage] = useState('');

// Estado para controlar la animación de desaparición del mensaje
const [messageOpacity] = useState(new Animated.Value(0));

// Referencia para el temporizador de desaparición de mensajes
// useRef nos permite mantener una referencia que persiste entre renders pero no causa re-renders
const messageTimeoutRef = React.useRef(null);

  // Función que calcula el nivel basado en la experiencia total
  // Los niveles crean una sensación de progreso a largo plazo
  const calculateLevel = (experience) => {
    // Cada 100 puntos de experiencia equivale a un nivel
    // Esto crea una progresión que se siente alcanzable pero significativa
    return Math.floor(experience / 100) + 1;
  };

  // Función que genera mensajes motivacionales basados en el contexto
  // Estos mensajes se adaptan a la situación específica del usuario
  const generateMotivationalMessage = (habit, isNewRecord = false) => {
    const messages = {
      // Mensajes para rachas cortas (1-5 días)
      short: [
        `¡Genial! Ya llevas ${habit.currentStreak} días con ${habit.name}. ¡Cada día cuenta!`,
        `¡Fantástico! ${habit.currentStreak} días consecutivos. ¡Estás construyendo algo grande!`,
        `¡Increíble! Ya van ${habit.currentStreak} días. ¡El momentum está de tu lado!`
      ],
      // Mensajes para rachas medianas (6-15 días)
      medium: [
        `¡WOW! ${habit.currentStreak} días seguidos con ${habit.name}. ¡Eres imparable!`,
        `¡Impresionante! ${habit.currentStreak} días de constancia. ¡Esto ya es un hábito real!`,
        `¡Brutal! ${habit.currentStreak} días consecutivos. ¡Tu disciplina es admirable!`
      ],
      // Mensajes para rachas largas (16+ días)
      long: [
        `¡ÉPICO! ${habit.currentStreak} días seguidos. ¡Eres una máquina de hábitos!`,
        `¡LEYENDA! ${habit.currentStreak} días consecutivos con ${habit.name}. ¡Esto es pura disciplina!`,
        `¡CAMPEÓN! ${habit.currentStreak} días sin parar. ¡Tu futuro yo te lo agradecerá!`
      ],
      // Mensaje especial para nuevos récords
      record: [
        `🏆 ¡NUEVO RÉCORD! ${habit.currentStreak} días. ¡Superaste tu marca anterior de ${habit.bestStreak} días!`,
        `🎉 ¡RÉCORD PERSONAL! ${habit.currentStreak} días consecutivos. ¡Eres oficialmente imparable!`
      ]
    };

    // Si es un nuevo récord, usamos mensaje especial
    if (isNewRecord) {
      return messages.record[Math.floor(Math.random() * messages.record.length)];
    }

    // Seleccionamos categoría basada en la racha actual
    let category;
    if (habit.currentStreak <= 5) {
      category = messages.short;
    } else if (habit.currentStreak <= 15) {
      category = messages.medium;
    } else {
      category = messages.long;
    }

    // Retornamos un mensaje aleatorio de la categoría apropiada
    return category[Math.floor(Math.random() * category.length)];
  };

// Función principal para completar un hábito
// Esta función coordina todos los aspectos de marcar un hábito como completado
const completeHabit = (habitId) => {
  setHabits(prevHabits => {
    return prevHabits.map(habit => {
      // Solo procesamos el hábito que el usuario tocó
      if (habit.id !== habitId) {
        return habit;
      }

      // Si ya está completado hoy, no hacemos nada (esto no debería suceder por el disabled, pero es una salvaguarda)
      if (habit.isCompleted) {
        return habit;
      }

      // Creamos una nueva versión del hábito con todas las actualizaciones
      const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
      
      // Calculamos la nueva racha considerando días de descanso
      const newStreak = calculateNewStreak(habit, today);
      
      // Determinamos si es un nuevo récord personal
      const isNewRecord = newStreak > habit.bestStreak;
      
      // Calculamos la experiencia ganada basada en la racha actual
      // Las rachas más largas otorgan más experiencia como recompensa por la consistencia
      const experienceGained = calculateExperienceGained(newStreak);
      
      // Creamos el hábito actualizado
      const updatedHabit = {
        ...habit,
        isCompleted: true,
        currentStreak: newStreak,
        bestStreak: Math.max(habit.bestStreak, newStreak),
        totalCompletions: habit.totalCompletions + 1,
        experience: habit.experience + experienceGained,
        level: calculateLevel(habit.experience + experienceGained),
        completions: [...habit.completions, today]
      };

      // Generamos el mensaje motivacional apropiado
      const message = generateMotivationalMessage(updatedHabit, isNewRecord);
      showMotivationalMessage(message);

      // Ejecutamos la animación de celebración
      celebrateCompletion();

      // En una aplicación real, aquí también reproduciríamos un sonido
      // Para el propósito de este tutorial, el feedback visual es suficiente
      
      return updatedHabit;
    });
  });
};

// Función para calcular la nueva racha considerando días de descanso
// Esta es una de las funciones más complejas porque debe entender el contexto temporal
const calculateNewStreak = (habit, completionDate) => {
  // Si es la primera vez que completa este hábito, la racha es 1
  if (habit.completions.length === 0) {
    return 1;
  }

  // Obtenemos la fecha de la última completación
  const lastCompletion = new Date(habit.completions[habit.completions.length - 1]);
  const currentDate = new Date(completionDate);
  
  // Calculamos cuántos días han pasado desde la última completación
  const daysDifference = Math.floor((currentDate - lastCompletion) / (1000 * 60 * 60 * 24));

  // Si completó ayer, simplemente incrementamos la racha
  if (daysDifference === 1) {
    return habit.currentStreak + 1;
  }

  // Si completó hoy (misma fecha), mantenemos la racha actual
  // Esto no debería suceder con nuestra lógica, pero es una salvaguarda
  if (daysDifference === 0) {
    return habit.currentStreak;
  }

  // Si han pasado más días, necesitamos verificar si hay días de descanso que justifiquen la ausencia
  if (daysDifference > 1 && habit.allowRestDays) {
    // Aquí podríamos implementar lógica más compleja para verificar días de descanso
    // Por simplicidad inicial, asumimos que si permite días de descanso y no han pasado más de 
    // una semana, la racha continúa. En una versión más sofisticada, verificaríamos 
    // específicamente qué días se marcaron como descanso
    if (daysDifference <= 7) {
      return habit.currentStreak + 1;
    }
  }

  // Si han pasado demasiados días sin justificación, la racha se reinicia
  return 1;
};

// Función para calcular experiencia ganada basada en la racha actual
// Implementa un sistema de recompensas progresivas que incentiva la consistencia a largo plazo
const calculateExperienceGained = (currentStreak) => {
  // Experiencia base por completar cualquier hábito
  let baseExperience = 10;
  
  // Bonificación por racha: más días consecutivos = más experiencia
  // Esto incentiva mantener las rachas en lugar de completar esporádicamente
  let streakBonus = 0;
  
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
    streakBonus += Math.floor((currentStreak - 30) / 7) * 5; // 5 puntos extra por cada semana adicional
  }
  
  return baseExperience + streakBonus;
};

// Función que maneja el ciclo completo de vida de los mensajes motivacionales
// Esta función coordina la aparición, duración, y desaparición de mensajes de manera elegante
// Función que maneja el ciclo completo de vida de los mensajes motivacionales
// Esta función coordina la aparición, duración, y desaparición de mensajes de manera elegante
const showMotivationalMessage = (message) => {
  console.log('🎯 showMotivationalMessage llamada con:', message);
  
  // Si hay un temporizador previo activo, lo cancelamos
  if (messageTimeoutRef.current) {
    console.log('⏰ Cancelando temporizador anterior');
    clearTimeout(messageTimeoutRef.current);
  }

  // Primero reseteamos la opacidad por si había un mensaje anterior desvaneciéndose
  messageOpacity.setValue(0);
  console.log('👁️ Opacidad reseteada a 0');
  
  // Establecemos el nuevo mensaje
  setMotivationalMessage(message);
  console.log('💬 Mensaje establecido');

  // Animación de aparición: el mensaje se desvanece suavemente hacia la vista
  Animated.timing(messageOpacity, {
    toValue: 1,
    duration: 400,
    useNativeDriver: true,
  }).start(() => {
    console.log('✨ Animación de aparición completada');
  });

  // Programamos la desaparición automática después de 5 segundos
  console.log('⏳ Programando desaparición en 5 segundos');
  messageTimeoutRef.current = setTimeout(() => {
    console.log('🕐 Ejecutando desaparición después de 5 segundos');
    
    // Animación de desaparición: el mensaje se desvanece suavemente
    Animated.timing(messageOpacity, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start(() => {
      console.log('🫥 Animación de desaparición completada, limpiando mensaje');
      // Una vez que la animación de desaparición termina, limpiamos el mensaje
      setMotivationalMessage('');
      messageTimeoutRef.current = null;
    });
  }, 5000); // 5000ms = 5 segundos de duración visible
  
  console.log('🏁 showMotivationalMessage completada, temporizador ID:', messageTimeoutRef.current);
};


// Función para marcar un día como día de descanso
// Esta función permite mantener las rachas mientras reconoce que algunos hábitos necesitan flexibilidad
const markRestDay = (habitId) => {
  // Primero verificamos que el usuario realmente quiere marcar este día como descanso
  // Los días de descanso deben ser decisiones conscientes, no escapes fáciles
  Alert.alert(
    '¿Día de descanso?',
    'Marcar hoy como día de descanso mantendrá tu racha activa. ¿Estás seguro?',
    [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Sí, es descanso',
        onPress: () => {
          setHabits(prevHabits => {
            return prevHabits.map(habit => {
              if (habit.id !== habitId) {
                return habit;
              }

              const today = new Date().toISOString().split('T')[0];
              
              // Marcamos el día como descanso y actualizamos el estado
              const updatedHabit = {
                ...habit,
                restDays: [...habit.restDays, today],
                // No marcamos como completado, pero tampoco rompemos la racha
              };

              // Mensaje motivacional específico para días de descanso
              showMotivationalMessage(
                `😴 Día de descanso registrado para ${habit.name}. ¡El descanso también es parte del progreso! Tu racha de ${habit.currentStreak} días se mantiene.`
              );

              return updatedHabit;
            });
          });
        },
      },
    ]
  );
};

  // Función que ejecuta la animación de celebración
  // Esta animación proporciona feedback visual inmediato
  const celebrateCompletion = () => {
    // Primero reseteamos la animación
    celebrationAnim.setValue(0);
    
    // Luego creamos una secuencia de animación que:
    // 1. Escala el elemento hacia arriba
    // 2. Lo mantiene por un momento
    // 3. Lo regresa a tamaño normal
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

  // Por ahora, renderizamos una versión básica para probar la estructura
  // En los siguientes pasos añadiremos la interfaz visual completa
 return (
  <View style={styles.container}>
    {/* Header con información general del usuario */}
    <View style={styles.header}>
      <Text style={styles.title}>Mis Hábitos</Text>
      <Text style={styles.subtitle}>
        {habits.filter(h => h.isCompleted).length} de {habits.length} completados hoy
      </Text>
    </View>

    {/* Mensaje motivacional si existe */}
    {motivationalMessage ? (
  <Animated.View 
    style={[
      styles.messageContainer,
      {
        opacity: messageOpacity, // Añadimos la animación de opacidad
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

    {/* Lista scrolleable de hábitos */}
    <ScrollView 
      style={styles.habitsContainer}
      showsVerticalScrollIndicator={false}
    >
      {habits.map(habit => (
        <View key={habit.id} style={styles.habitCard}>
          {/* Header del hábito con nombre y descripción */}
          <View style={styles.habitHeader}>
            <View style={styles.habitInfo}>
              <Text style={styles.habitName}>{habit.name}</Text>
              <Text style={styles.habitDescription}>{habit.description}</Text>
            </View>
            
            {/* Indicador de nivel */}
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Nv. {habit.level}</Text>
            </View>
          </View>

          {/* Estadísticas principales del hábito */}
          <View style={styles.statsContainer}>
            {/* Racha actual - la métrica más importante */}
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{habit.currentStreak}</Text>
              <Text style={styles.statLabel}>Días seguidos</Text>
            </View>

            {/* Mejor racha histórica */}
            <View style={styles.statItem}>
              <Text style={[
                styles.statNumber, 
                { color: habit.currentStreak > habit.bestStreak ? '#e74c3c' : '#7f8c8d' }
              ]}>
                {habit.bestStreak}
              </Text>
              <Text style={styles.statLabel}>Mejor racha</Text>
            </View>

            {/* Completaciones totales */}
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{habit.totalCompletions}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>

          {/* Barra de progreso hacia el siguiente nivel */}
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

          {/* Información sobre días de descanso si aplica */}
          {habit.allowRestDays && (
            <View style={styles.restDaysInfo}>
              <Text style={styles.restDaysText}>
                📅 Permite {habit.restDaysPerWeek} días de descanso por semana
              </Text>
            </View>
          )}

          {/* Botones de acción */}
          <View style={styles.actionButtons}>
            {/* Botón principal - Completar o Ya completado */}
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
                {habit.isCompleted ? '✅ Completado hoy' : '🎯 Logrado'}
              </Text>
            </TouchableOpacity>

            {/* Botón de día de descanso si está permitido */}
            {habit.allowRestDays && !habit.isCompleted && (
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
    </ScrollView>

    {/* Botón flotante para agregar nuevos hábitos (placeholder por ahora) */}
    <TouchableOpacity style={styles.addButton}>
      <Text style={styles.addButtonText}>+</Text>
    </TouchableOpacity>
  </View>
);
}

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
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#e74c3c',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});