import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

// Creamos el contexto de autenticación que será el punto central de gestión de estado
// Este contexto permitirá que cualquier componente acceda a la información de autenticación
const AuthContext = createContext({});

// Hook personalizado que simplifica el acceso al contexto de autenticación
// En lugar de usar useContext(AuthContext) en cada componente, usamos useAuth()
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Componente proveedor que envuelve toda la aplicación y gestiona el estado de autenticación
export const AuthProvider = ({ children }) => {
  // Estado que almacena la información del usuario autenticado
  // null significa no autenticado, un objeto significa autenticado
  const [user, setUser] = useState(null);
  
  // Estado que indica si estamos verificando el estado de autenticación inicial
  // Esto previene mostrar la pantalla incorrecta mientras verificamos si hay una sesión existente
  const [loading, setLoading] = useState(true);
  
  // Estado que almacena la información extendida del perfil del usuario
  // Esta información viene de nuestra tabla profiles personalizada
  const [profile, setProfile] = useState(null);

  // Función para obtener el perfil completo del usuario desde nuestra base de datos
  // Esta función se ejecuta después de una autenticación exitosa para cargar datos adicionales
  const fetchUserProfile = async (userId) => {
    try {
      // Consultamos la tabla profiles para obtener información extendida del usuario
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(); // single() asegura que obtengamos exactamente un registro

      if (error) {
        console.error('Error al obtener perfil:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error inesperado al obtener perfil:', error);
      return null;
    }
  };

  // Función para manejar cambios en el estado de autenticación
  // Esta función se ejecuta automáticamente cada vez que el estado de sesión cambia
  const handleAuthStateChange = async (event, session) => {
    console.log('Cambio de estado de autenticación:', event, session?.user?.email);
    
    if (session?.user) {
      // Si hay una sesión válida, establecemos el usuario y obtenemos su perfil
      setUser(session.user);
      
      // Intentamos obtener el perfil completo del usuario
      const userProfile = await fetchUserProfile(session.user.id);
      setProfile(userProfile);
      
      if (!userProfile) {
        console.warn('No se pudo obtener el perfil del usuario. Esto podría indicar un problema de sincronización.');
      }
    } else {
      // Si no hay sesión, limpiamos todos los estados relacionados con el usuario
      setUser(null);
      setProfile(null);
    }
    
    // Marcamos que hemos terminado de verificar el estado inicial
    setLoading(false);
  };

  // Efecto que configura el listener de cambios de autenticación cuando el componente se monta
  useEffect(() => {
    console.log('Configurando listener de autenticación...');
    
    // Obtenemos la sesión actual si existe
    // Esto es importante para cuando la aplicación se abre y ya hay una sesión válida
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Sesión inicial:', session?.user?.email || 'No hay sesión');
      handleAuthStateChange('INITIAL_SESSION', session);
    });

    // Configuramos el listener para cambios futuros en el estado de autenticación
    // Este listener se ejecutará automáticamente cuando el usuario se registre, inicie sesión, o cierre sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    // Función de limpieza que remueve el listener cuando el componente se desmonta
    // Esto previene memory leaks y comportamientos inesperados
    return () => {
      console.log('Removiendo listener de autenticación...');
      subscription?.unsubscribe();
    };
  }, []); // El array vacío asegura que este efecto se ejecute solo una vez

  // Función para cerrar sesión que limpia todo el estado relacionado con el usuario
  const signOut = async () => {
    try {
      console.log('Cerrando sesión...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error al cerrar sesión:', error);
        return { error };
      }
      
      // No necesitamos limpiar manualmente los estados porque el listener se encargará
      console.log('Sesión cerrada exitosamente');
      return { error: null };
    } catch (error) {
      console.error('Error inesperado al cerrar sesión:', error);
      return { error };
    }
  };

  // Función para refrescar los datos del perfil cuando sea necesario
  // Útil después de actualizaciones de perfil o para sincronizar datos
  const refreshProfile = async () => {
    if (user) {
      const updatedProfile = await fetchUserProfile(user.id);
      setProfile(updatedProfile);
      return updatedProfile;
    }
    return null;
  };

  // Objeto que contiene todos los valores y funciones que queremos hacer disponibles
  // a través del contexto a otros componentes de la aplicación
  const value = {
    user,              // Información básica del usuario autenticado
    profile,           // Información extendida del perfil del usuario
    loading,           // Indicador de si estamos verificando el estado inicial
    signOut,           // Función para cerrar sesión
    refreshProfile,    // Función para refrescar datos del perfil
  };

  // Proporcionamos el contexto a todos los componentes hijos
  // Cualquier componente dentro de este proveedor puede acceder a los valores de autenticación
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};