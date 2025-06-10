import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Por ahora usaremos valores de placeholder para la configuración
// En el siguiente paso, crearemos un proyecto Supabase real y obtendremos las credenciales reales
const supabaseUrl = 'https://eyrarrxsezfmxstpwqqp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cmFycnhzZXpmbXhzdHB3cXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1NjgyMjEsImV4cCI6MjA2NTE0NDIyMX0.nprf4MqXu5XgQLGgl1_f7eWe5XpHiCEbf_15Rr7d3dQ';

// Configuración del cliente Supabase con almacenamiento persistente
// AsyncStorage permite que la sesión de autenticación persista entre cierres de la aplicación
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configuramos AsyncStorage como el mecanismo de almacenamiento para tokens de autenticación
    // Esto significa que una vez que un usuario se autentica, permanecerá conectado
    // incluso si cierra y abre la aplicación nuevamente
    storage: AsyncStorage,
    // autoRefreshToken mantiene automáticamente la sesión activa
    // renovando tokens antes de que expiren
    autoRefreshToken: true,
    // persistSession asegura que la información de sesión se guarde localmente
    persistSession: true,
    // detectSessionInUrl es false porque las aplicaciones móviles no manejan URLs de callback
    // de la misma manera que las aplicaciones web
    detectSessionInUrl: false,
  },
});

// Al final de tu archivo src/config/supabase.js, después de export const supabase = ...
console.log('🔧 Supabase configurado con URL:', supabaseUrl);
console.log('🔧 Supabase configurado correctamente');