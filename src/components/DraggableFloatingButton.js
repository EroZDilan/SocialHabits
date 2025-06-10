import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Platform
} from 'react-native';

// Obtenemos las dimensiones de la pantalla para calcular límites de movimiento
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Constantes que definen el comportamiento del botón flotante
const BUTTON_SIZE = 56; // Tamaño del botón en puntos
const EDGE_MARGIN = 20; // Margen mínimo desde los bordes de la pantalla
const SNAP_THRESHOLD = screenWidth / 2; // Punto medio para decidir a qué lado adherirse
const ANIMATION_DURATION = 300; // Duración de las animaciones en milisegundos

export default function DraggableFloatingButton({ onPress, style = {} }) {
  // Referencias para las animaciones de posición
  // Estas referencias mantienen las coordenadas X e Y del botón de manera persistente
  const panX = useRef(new Animated.Value(screenWidth - BUTTON_SIZE - EDGE_MARGIN)).current;
  const panY = useRef(new Animated.Value(screenHeight - BUTTON_SIZE - 100)).current;
  
  // Referencias para rastrear la posición durante el arrastre
  // Necesitamos esto porque Animated.Value no siempre refleja la posición visual actual durante las animaciones
  const currentX = useRef(screenWidth - BUTTON_SIZE - EDGE_MARGIN);
  const currentY = useRef(screenHeight - BUTTON_SIZE - 100);

  // Estado para rastrear si el usuario está arrastrando actualmente
  // Esto nos permite cambiar la apariencia visual durante el arrastre
  const isDragging = useRef(new Animated.Value(0)).current;

  // Función que maneja el comportamiento de "adherirse" a los bordes
  // Esta función implementa la física que hace que el botón se posicione automáticamente en el borde más cercano
  const snapToEdge = () => {
    const targetX = currentX.current < SNAP_THRESHOLD 
      ? EDGE_MARGIN // Si está en la mitad izquierda, va al borde izquierdo
      : screenWidth - BUTTON_SIZE - EDGE_MARGIN; // Si está en la mitad derecha, va al borde derecho
    
    // Aseguramos que la posición Y esté dentro de los límites válidos
    const targetY = Math.max(
      EDGE_MARGIN, 
      Math.min(currentY.current, screenHeight - BUTTON_SIZE - EDGE_MARGIN)
    );

    console.log('Botón flotante adhiriéndose a posición:', { targetX, targetY });

    // Ejecutamos una animación suave hacia la posición objetivo
    Animated.parallel([
      Animated.spring(panX, {
        toValue: targetX,
        useNativeDriver: false, // No podemos usar el driver nativo para transformaciones de layout
        tension: 100, // Controla qué tan "rígido" se siente el resorte
        friction: 8, // Controla qué tan rápido se detiene el movimiento
      }),
      Animated.spring(panY, {
        toValue: targetY,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      })
    ]).start(() => {
      // Actualizamos nuestras referencias de posición después de que termine la animación
      currentX.current = targetX;
      currentY.current = targetY;
    });
  };

  // Configuramos el responder de gestos que manejará todos los eventos táctiles
  // PanResponder es el sistema de bajo nivel que nos permite interceptar y manejar gestos complejos
  const panResponder = useRef(
    PanResponder.create({
      // Esta función determina si el componente debe responder al gesto
      // Retornamos true para indicar que queremos manejar todos los toques en este botón
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Solo iniciamos el arrastre si el usuario se mueve más de 5 puntos
        // Esto previene activar el modo arrastre en toques accidentales
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },

      // Esta función se llama cuando comenzamos a responder al gesto
      onPanResponderGrant: (evt, gestureState) => {
        console.log('Botón flotante: iniciando arrastre');
        
        // Animamos el botón para que crezca ligeramente, indicando que está siendo arrastrado
        Animated.spring(isDragging, {
          toValue: 1,
          useNativeDriver: false,
          tension: 300,
          friction: 10,
        }).start();

        // Establecemos el valor inicial de las animaciones a la posición actual
        // Esto es crucial para que el arrastre se sienta natural desde la primera interacción
        panX.setOffset(currentX.current);
        panY.setOffset(currentY.current);
        panX.setValue(0);
        panY.setValue(0);
      },

      // Esta función se llama continuamente mientras el usuario arrastra
      onPanResponderMove: (evt, gestureState) => {
        // Calculamos las nuevas posiciones basadas en el movimiento del dedo
        const newX = gestureState.dx;
        const newY = gestureState.dy;

        // Aplicamos límites para asegurar que el botón no salga de la pantalla
        const boundedX = Math.max(
          -currentX.current + EDGE_MARGIN,
          Math.min(newX, screenWidth - BUTTON_SIZE - EDGE_MARGIN - currentX.current)
        );
        const boundedY = Math.max(
          -currentY.current + EDGE_MARGIN,
          Math.min(newY, screenHeight - BUTTON_SIZE - EDGE_MARGIN - currentY.current)
        );

        // Actualizamos las animaciones para reflejar la nueva posición
        // Esta función se ejecuta a 60 FPS, creando movimiento suave y responsivo
        Animated.event(
          [null, { dx: panX, dy: panY }],
          { useNativeDriver: false }
        )(evt, { dx: boundedX, dy: boundedY });
      },

      // Esta función se llama cuando el usuario suelta el botón
      onPanResponderRelease: (evt, gestureState) => {
        console.log('Botón flotante: finalizando arrastre con velocidad:', gestureState.vx, gestureState.vy);

        // Determinamos si fue un toque rápido o un arrastre real
        const isQuickTap = Math.abs(gestureState.dx) < 10 && 
                          Math.abs(gestureState.dy) < 10 && 
                          gestureState.dt < 200; // Menos de 200ms

        if (isQuickTap) {
          console.log('Botón flotante: detectado toque rápido, ejecutando acción');
          // Si fue un toque rápido, ejecutamos la acción del botón
          onPress && onPress();
        } else {
          // Si fue un arrastre real, actualizamos la posición y adherimos a los bordes
          currentX.current += gestureState.dx;
          currentY.current += gestureState.dy;
          snapToEdge();
        }

        // Limpiamos los offsets de las animaciones
        panX.flattenOffset();
        panY.flattenOffset();

        // Animamos el botón de vuelta a su tamaño normal
        Animated.spring(isDragging, {
          toValue: 0,
          useNativeDriver: false,
          tension: 300,
          friction: 10,
        }).start();
      },
    })
  ).current;

  // Efecto que configura la posición inicial cuando el componente se monta
  useEffect(() => {
    console.log('Botón flotante: configurando posición inicial');
    // Configuramos los listeners para mantener sincronizadas nuestras referencias de posición
    const xListener = panX.addListener(({ value }) => {
      currentX.current = value;
    });
    const yListener = panY.addListener(({ value }) => {
      currentY.current = value;
    });

    // Función de limpieza que remueve los listeners cuando el componente se desmonta
    return () => {
      panX.removeListener(xListener);
      panY.removeListener(yListener);
    };
  }, []);

  return (
  <Animated.View
    style={[
      styles.container,
      {
        transform: [
          { translateX: panX },
          { translateY: panY },
          { 
            scale: isDragging.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.1],
            })
          }
        ],
        shadowOpacity: isDragging.interpolate({
          inputRange: [0, 1],
          outputRange: [0.2, 0.4],
        }),
        elevation: isDragging.interpolate({
          inputRange: [0, 1],
          outputRange: [4, 8],
        }),
      },
      style
    ]}
    {...panResponder.panHandlers}
  >
    {/* Añadimos un TouchableOpacity como respaldo para toques simples */}
    <TouchableOpacity 
      style={styles.button}
      onPress={() => {
        console.log('🟢 TouchableOpacity respaldo: toque detectado');
        if (onPress && typeof onPress === 'function') {
          onPress();
          console.log('🟢 TouchableOpacity respaldo: onPress ejecutado');
        }
      }}
      activeOpacity={0.8}
    >
      <Text style={styles.buttonText}>+</Text>
    </TouchableOpacity>
  </Animated.View>
);
}

// Estilos que crean un botón flotante moderno y atractivo
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    zIndex: 1000, // Aseguramos que aparezca por encima de todo el contenido
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2, // Hace que sea un círculo perfecto
    backgroundColor: '#e74c3c', // Color rojo vibrante que destaca
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4, // Sombra en Android
    
    // Añadimos un efecto de gradiente sutil usando borderWidth y colores
    borderWidth: 2,
    borderColor: '#c0392b', // Un rojo ligeramente más oscuro para el borde
  },
  buttonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 28, // Aseguramos que el + esté perfectamente centrado
  },
});