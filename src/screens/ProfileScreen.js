import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  Image,
  Dimensions
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import ProfileEditModal from '../components/ProfileEditModal';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  // Accedemos al usuario autenticado y su perfil
  const { user, profile, refreshProfile } = useAuth();
  
  // Estados para manejar el perfil expandido y estadísticas
  const [userStats, setUserStats] = useState({
    totalHabits: 0,
    activeStreaks: 0,
    bestStreak: 0,
    totalCompletions: 0,
    groupsCount: 0,
    achievementsCount: 0
  });
  
  // Estados para control de la interfaz
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Función para cargar estadísticas completas del usuario
  const loadUserStats = async () => {
    if (!user) return;

    try {
      console.log('👤 Cargando estadísticas de perfil para:', user.email);

      // Cargamos hábitos activos y sus estadísticas
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select(`
          id,
          name,
          user_id,
          group_id,
          is_active,
          habit_completions!inner(completed_date)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (habitsError) {
        console.error('Error al cargar hábitos:', habitsError);
        return;
      }

      // Calculamos estadísticas de hábitos
      const totalHabits = habits?.length || 0;
      let totalCompletions = 0;
      let activeStreaks = 0;
      let bestStreak = 0;

      // Para cada hábito, calculamos su racha actual y mejor racha
      if (habits && habits.length > 0) {
        for (const habit of habits) {
          const completions = habit.habit_completions || [];
          totalCompletions += completions.length;
          
          // Calculamos racha actual para este hábito
          const currentStreak = calculateCurrentStreak(completions);
          if (currentStreak > 0) {
            activeStreaks += 1;
          }
          
          // Actualizamos la mejor racha general
          if (currentStreak > bestStreak) {
            bestStreak = currentStreak;
          }
        }
      }

      // Cargamos información de grupos
      const { data: groupMemberships, error: groupsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (groupsError) {
        console.error('Error al cargar grupos:', groupsError);
      }

      const groupsCount = groupMemberships?.length || 0;

      // Calculamos logros/achievements (simplificado por ahora)
      const achievementsCount = calculateAchievements(totalCompletions, bestStreak, groupsCount);

      const stats = {
        totalHabits,
        activeStreaks,
        bestStreak,
        totalCompletions,
        groupsCount,
        achievementsCount
      };

      setUserStats(stats);
      console.log('📊 Estadísticas calculadas:', stats);

    } catch (error) {
      console.error('Error inesperado al cargar estadísticas:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Función para calcular racha actual basándose en completaciones
  const calculateCurrentStreak = (completions) => {
    if (!completions || completions.length === 0) return 0;

    const sortedCompletions = completions
      .map(c => new Date(c.completed_date))
      .sort((a, b) => b - a);

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedCompletions.length; i++) {
      const completionDate = new Date(sortedCompletions[i]);
      completionDate.setHours(0, 0, 0, 0);
      
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - streak);
      
      if (completionDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  // Función simple para calcular achievements
  const calculateAchievements = (completions, bestStreak, groups) => {
    let achievements = 0;
    
    // Achievement por primeros pasos
    if (completions > 0) achievements++;
    
    // Achievement por consistencia
    if (bestStreak >= 7) achievements++;
    if (bestStreak >= 30) achievements++;
    
    // Achievement social
    if (groups > 0) achievements++;
    if (groups >= 3) achievements++;
    
    // Achievement por volumen
    if (completions >= 50) achievements++;
    if (completions >= 200) achievements++;
    
    return achievements;
  };

  // Función para abrir el modal de edición
  const openEditModal = () => {
    console.log('👤 Abriendo modal de edición de perfil');
    setShowEditModal(true);
  };

  // Función para cerrar el modal de edición
  const closeEditModal = () => {
    console.log('👤 Cerrando modal de edición de perfil');
    setShowEditModal(false);
  };

  // Función callback cuando se guarda el perfil
  const handleProfileSaved = async () => {
    console.log('👤 Perfil guardado, actualizando datos');
    await refreshProfile();
    await loadUserStats();
  };

  // Función para cerrar sesión con confirmación
  const handleSignOut = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar Sesión', 
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert('Error', 'No se pudo cerrar sesión. Intenta nuevamente.');
            }
          }
        }
      ]
    );
  };

  // Función para manejar pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadUserStats();
  };

  // Función para obtener URL del avatar
  const getAvatarUrl = () => {
    if (!profile?.avatar_url) return null;
    
    // Si es una URL completa, la usamos directamente
    if (profile.avatar_url.startsWith('http')) {
      return profile.avatar_url;
    }
    
    // Si es un path de Supabase Storage, construimos la URL
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(profile.avatar_url);
    
    return data.publicUrl;
  };

  // Función para determinar qué estadísticas mostrar basándose en configuraciones de privacidad
  const shouldShowStat = (statKey) => {
    return profile?.public_stats?.[statKey] !== false;
  };

  // Efecto para cargar datos cuando el componente se monta
  useEffect(() => {
    if (user) {
      loadUserStats();
    }
  }, [user]);

  // Renderizado de pantalla de carga
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando tu perfil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3498db']}
            tintColor="#3498db"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header del perfil con foto y información básica */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {getAvatarUrl() ? (
              <Image
                source={{ uri: getAvatarUrl() }}
                style={styles.avatar}
                onError={() => console.log('Error cargando avatar')}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {(profile?.full_name || profile?.username || user?.email || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.editAvatarButton} onPress={openEditModal}>
              <Text style={styles.editAvatarButtonText}>📷</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>
              {profile?.full_name || profile?.username || 'Usuario'}
            </Text>
            <Text style={styles.username}>@{profile?.username || 'usuario'}</Text>
            
            {profile?.bio && (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}

            {profile?.location && (
              <Text style={styles.location}>📍 {profile.location}</Text>
            )}

            {profile?.website && (
              <Text style={styles.website}>🔗 {profile.website}</Text>
            )}
          </View>

          <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
            <Text style={styles.editButtonText}>✏️ Editar Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Panel de estadísticas públicas */}
        <View style={styles.statsPanel}>
          <Text style={styles.statsPanelTitle}>Mis Estadísticas</Text>
          
          <View style={styles.statsGrid}>
            {shouldShowStat('show_total_habits') && (
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{userStats.totalHabits}</Text>
                <Text style={styles.statLabel}>Hábitos Activos</Text>
              </View>
            )}
            
            {shouldShowStat('show_current_streaks') && (
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{userStats.activeStreaks}</Text>
                <Text style={styles.statLabel}>Rachas Activas</Text>
              </View>
            )}
            
            {shouldShowStat('show_best_streaks') && (
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{userStats.bestStreak}</Text>
                <Text style={styles.statLabel}>Mejor Racha</Text>
              </View>
            )}
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userStats.totalCompletions}</Text>
              <Text style={styles.statLabel}>Completaciones</Text>
            </View>
            
            {shouldShowStat('show_groups') && (
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{userStats.groupsCount}</Text>
                <Text style={styles.statLabel}>Grupos</Text>
              </View>
            )}
            
            {shouldShowStat('show_achievements') && (
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{userStats.achievementsCount}</Text>
                <Text style={styles.statLabel}>Logros</Text>
              </View>
            )}
          </View>
        </View>

        {/* Sección de configuraciones rápidas */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Configuraciones</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={openEditModal}>
            <Text style={styles.settingItemText}>⚙️ Editar Perfil y Privacidad</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert('Próximamente', 'Las notificaciones se implementarán pronto.')}>
            <Text style={styles.settingItemText}>🔔 Configurar Notificaciones</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert('Próximamente', 'La exportación de datos estará disponible pronto.')}>
            <Text style={styles.settingItemText}>📊 Exportar Mis Datos</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} onPress={handleSignOut}>
            <Text style={[styles.settingItemText, styles.dangerText]}>🚪 Cerrar Sesión</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Información adicional sobre el perfil */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>💡 Sobre tu Perfil</Text>
          <Text style={styles.infoText}>
            Tu perfil es visible para otros miembros de tus grupos. Puedes controlar qué información 
            compartes en la configuración de privacidad.
          </Text>
          <Text style={styles.infoText}>
            Las estadísticas que elijas mostrar ayudan a motivar a otros miembros de tu comunidad 
            de hábitos.
          </Text>
        </View>
      </ScrollView>

      {/* Modal de edición de perfil */}
      <ProfileEditModal
        visible={showEditModal}
        onClose={closeEditModal}
        onSave={handleProfileSaved}
        currentProfile={profile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
  },
  loadingText: {
    fontSize: 18,
    color: '#3498db',
    marginTop: 10,
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: '#ffffff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#3498db',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2980b9',
  },
  avatarPlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3498db',
  },
  editAvatarButtonText: {
    fontSize: 12,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  username: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  bio: {
    fontSize: 16,
    color: '#34495e',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  location: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  website: {
    fontSize: 14,
    color: '#3498db',
    marginBottom: 5,
  },
  editButton: {
    backgroundColor: '#3498db',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsPanel: {
    backgroundColor: '#ffffff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsPanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 15,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3498db',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  settingsSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  settingItemText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  settingItemArrow: {
    fontSize: 18,
    color: '#bdc3c7',
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#e74c3c',
  },
  infoSection: {
    backgroundColor: '#e8f4fd',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2980b9',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#34495e',
    lineHeight: 20,
    marginBottom: 8,
  },
});