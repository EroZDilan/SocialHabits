import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Alert
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function PublicProfileComponent({ visible, onClose, userId, username }) {
  // Accedemos al usuario autenticado para comparaciones
  const { user } = useAuth();
  
  // Estados para el perfil público y sus estadísticas
  const [profileData, setProfileData] = useState(null);
  const [userStats, setUserStats] = useState({
    totalHabits: 0,
    activeStreaks: 0,
    bestStreak: 0,
    totalCompletions: 0,
    groupsCount: 0,
    achievementsCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [mutualGroups, setMutualGroups] = useState([]);

  // Función para cargar el perfil público del usuario
  const loadPublicProfile = async () => {
    if (!userId && !username) return;

    setLoading(true);
    try {
      console.log('👥 Cargando perfil público para:', userId || username);

      // Cargamos el perfil básico
      let query = supabase
        .from('profiles')
        .select('*')
        .single();

      if (userId) {
        query = query.eq('id', userId);
      } else {
        query = query.eq('username', username.toLowerCase());
      }

      const { data: profile, error: profileError } = await query;

      if (profileError) {
        console.error('Error cargando perfil público:', profileError);
        Alert.alert('Error', 'No se pudo cargar el perfil del usuario.');
        onClose();
        return;
      }

      setProfileData(profile);

      // Verificamos las configuraciones de privacidad
      const privacySettings = profile.privacy_settings || {};
      const publicStats = profile.public_stats || {};

      // Si el perfil no es público, mostramos información limitada
      if (privacySettings.profile_visibility === 'private') {
        console.log('👥 Perfil privado, mostrando información limitada');
        setLoading(false);
        return;
      }

      // Cargamos estadísticas públicas si están habilitadas
      await loadPublicStats(profile.id, publicStats);

      // Cargamos grupos mutuos
      await loadMutualGroups(profile.id);

    } catch (error) {
      console.error('Error inesperado cargando perfil:', error);
      Alert.alert('Error', 'Ocurrió un error inesperado.');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar estadísticas públicas del usuario
  const loadPublicStats = async (targetUserId, publicStats) => {
    try {
      let stats = {
        totalHabits: 0,
        activeStreaks: 0,
        bestStreak: 0,
        totalCompletions: 0,
        groupsCount: 0,
        achievementsCount: 0
      };

      // Solo cargamos estadísticas que el usuario ha elegido hacer públicas
      if (publicStats.show_total_habits || publicStats.show_current_streaks || publicStats.show_best_streaks) {
        const { data: habits, error: habitsError } = await supabase
          .from('habits')
          .select(`
            id,
            name,
            habit_completions!inner(completed_date)
          `)
          .eq('user_id', targetUserId)
          .eq('is_active', true);

        if (!habitsError && habits) {
          stats.totalHabits = habits.length;
          
          // Calculamos estadísticas de rachas si están habilitadas
          if (publicStats.show_current_streaks || publicStats.show_best_streaks) {
            for (const habit of habits) {
              const completions = habit.habit_completions || [];
              stats.totalCompletions += completions.length;
              
              const currentStreak = calculateCurrentStreak(completions);
              if (currentStreak > 0) {
                stats.activeStreaks += 1;
              }
              
              if (currentStreak > stats.bestStreak) {
                stats.bestStreak = currentStreak;
              }
            }
          }
        }
      }

      // Cargamos información de grupos si está habilitada
      if (publicStats.show_groups) {
        const { data: groupMemberships, error: groupsError } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', targetUserId);

        if (!groupsError) {
          stats.groupsCount = groupMemberships?.length || 0;
        }
      }

      // Calculamos achievements si están habilitados
      if (publicStats.show_achievements) {
        stats.achievementsCount = calculateAchievements(
          stats.totalCompletions, 
          stats.bestStreak, 
          stats.groupsCount
        );
      }

      setUserStats(stats);

    } catch (error) {
      console.error('Error cargando estadísticas públicas:', error);
    }
  };

  // Función para encontrar grupos mutuos entre el usuario actual y el perfil visualizado
  const loadMutualGroups = async (targetUserId) => {
    if (!user) return;

    try {
      // Obtenemos grupos del usuario actual
      const { data: currentUserGroups, error: currentError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (currentError) return;

      // Obtenemos grupos del usuario objetivo
      const { data: targetUserGroups, error: targetError } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (id, name)
        `)
        .eq('user_id', targetUserId);

      if (targetError) return;

      // Encontramos intersección de grupos
      const currentGroupIds = new Set(currentUserGroups?.map(g => g.group_id) || []);
      const mutualGroupsData = targetUserGroups?.filter(membership => 
        currentGroupIds.has(membership.group_id)
      ).map(membership => membership.groups) || [];

      setMutualGroups(mutualGroupsData);
      console.log('👥 Grupos mutuos encontrados:', mutualGroupsData.length);

    } catch (error) {
      console.error('Error cargando grupos mutuos:', error);
    }
  };

  // Función auxiliar para calcular racha actual
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

  // Función auxiliar para calcular achievements
  const calculateAchievements = (completions, bestStreak, groups) => {
    let achievements = 0;
    if (completions > 0) achievements++;
    if (bestStreak >= 7) achievements++;
    if (bestStreak >= 30) achievements++;
    if (groups > 0) achievements++;
    if (groups >= 3) achievements++;
    if (completions >= 50) achievements++;
    if (completions >= 200) achievements++;
    return achievements;
  };

  // Función para obtener URL del avatar
  const getAvatarUrl = () => {
    if (!profileData?.avatar_url) return null;
    
    if (profileData.avatar_url.startsWith('http')) {
      return profileData.avatar_url;
    }
    
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(profileData.avatar_url);
    
    return data.publicUrl;
  };

  // Función para determinar qué estadísticas mostrar
  const shouldShowStat = (statKey) => {
    return profileData?.public_stats?.[statKey] !== false;
  };

  // Función para enviar invitación a grupo (placeholder)
  const inviteToGroup = () => {
    Alert.alert(
      'Invitar a Grupo',
      'La funcionalidad de invitar directamente desde perfiles se implementará próximamente.',
      [{ text: 'Entendido', style: 'default' }]
    );
  };

  // Efecto para cargar datos cuando se abre el modal
  useEffect(() => {
    if (visible && (userId || username)) {
      loadPublicProfile();
    }
  }, [visible, userId, username]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header del modal */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Perfil de Usuario</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando perfil...</Text>
          </View>
        ) : !profileData ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>No se pudo cargar el perfil.</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Header del perfil */}
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                {getAvatarUrl() ? (
                  <Image
                    source={{ uri: getAvatarUrl() }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>
                      {(profileData.full_name || profileData.username || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.displayName}>
                  {profileData.full_name || profileData.username || 'Usuario'}
                </Text>
                <Text style={styles.username}>@{profileData.username || 'usuario'}</Text>
                
                {profileData.bio && (
                  <Text style={styles.bio}>{profileData.bio}</Text>
                )}

                {profileData.location && (
                  <Text style={styles.location}>📍 {profileData.location}</Text>
                )}

                {profileData.website && (
                  <Text style={styles.website}>🔗 {profileData.website}</Text>
                )}
              </View>

              {/* Botones de acción (solo si no es el propio perfil) */}
              {profileData.id !== user?.id && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.inviteButton} onPress={inviteToGroup}>
                    <Text style={styles.inviteButtonText}>📧 Invitar a Grupo</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Panel de estadísticas públicas */}
            {(shouldShowStat('show_total_habits') || 
              shouldShowStat('show_current_streaks') || 
              shouldShowStat('show_best_streaks') || 
              shouldShowStat('show_achievements') || 
              shouldShowStat('show_groups')) && (
              <View style={styles.statsPanel}>
                <Text style={styles.statsPanelTitle}>Estadísticas Públicas</Text>
                
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
            )}

            {/* Grupos mutuos */}
            {mutualGroups.length > 0 && (
              <View style={styles.mutualGroupsSection}>
                <Text style={styles.sectionTitle}>
                  👥 Grupos en Común ({mutualGroups.length})
                </Text>
                {mutualGroups.map((group) => (
                  <View key={group.id} style={styles.groupItem}>
                    <Text style={styles.groupItemText}>{group.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Información sobre privacidad */}
            <View style={styles.privacyInfo}>
              <Text style={styles.privacyInfoText}>
                Este usuario controla qué información es visible. Solo se muestran 
                las estadísticas que ha elegido hacer públicas.
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  closeButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#3498db',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
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
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#3498db',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2980b9',
  },
  avatarPlaceholderText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  displayName: {
    fontSize: 22,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  inviteButton: {
    backgroundColor: '#27ae60',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  inviteButtonText: {
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  mutualGroupsSection: {
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  groupItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  groupItemText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  privacyInfo: {
    backgroundColor: '#e8f4fd',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },
  privacyInfoText: {
    fontSize: 14,
    color: '#34495e',
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});