import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function GroupDetailsModal({ 
  visible, 
  onClose, 
  group, 
  userRole,
  onEditGroup,
  onManageMembers,
  onDeleteGroup
}) {
  const { user } = useAuth();
  
  // Estados para información del grupo
  const [groupStats, setGroupStats] = useState({
    totalMembers: 0,
    totalHabits: 0,
    totalLists: 0,
    createdDate: null
  });
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);

  // Función para cargar estadísticas del grupo
  const loadGroupStats = async () => {
    if (!group) return;

    setLoading(true);
    try {
      console.log('📊 Cargando estadísticas del grupo:', group.name);

      // Cargar miembros
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select(`
          id,
          role,
          joined_at,
          user_id,
          profiles:user_id (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('group_id', group.id)
        .order('joined_at', { ascending: true });

      if (membersError) {
        console.error('Error cargando miembros:', membersError);
      } else {
        setMembers(membersData || []);
      }

      // Cargar hábitos compartidos del grupo
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id')
        .eq('group_id', group.id)
        .eq('is_active', true);

      // Cargar listas colaborativas del grupo
      const { data: listsData, error: listsError } = await supabase
        .from('collaborative_lists')
        .select('id')
        .eq('group_id', group.id);

      const stats = {
        totalMembers: membersData?.length || 0,
        totalHabits: habitsData?.length || 0,
        totalLists: listsData?.length || 0,
        createdDate: group.created_at
      };

      setGroupStats(stats);
      console.log('📊 Estadísticas cargadas:', stats);

    } catch (error) {
      console.error('Error inesperado cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener URL del avatar
  const getAvatarUrl = (avatarUrl) => {
    if (!avatarUrl) return null;
    
    if (avatarUrl.startsWith('http')) {
      return avatarUrl;
    }
    
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(avatarUrl);
    
    return data.publicUrl;
  };

  // Función para formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'Fecha desconocida';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Función para obtener badge de rol
  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return { text: 'Admin', color: '#e74c3c' };
      case 'moderator':
        return { text: 'Mod', color: '#f39c12' };
      default:
        return { text: 'Miembro', color: '#3498db' };
    }
  };

  // Efecto para cargar datos cuando se abre el modal
  useEffect(() => {
    if (visible && group) {
      loadGroupStats();
    }
  }, [visible, group]);

  if (!group) return null;

  const isAdmin = userRole === 'admin';
  const isModerator = userRole === 'moderator' || userRole === 'admin';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Detalles del Grupo</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Información básica del grupo */}
          <View style={styles.groupInfoSection}>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description && (
              <Text style={styles.groupDescription}>{group.description}</Text>
            )}
            <Text style={styles.createdDate}>
              Creado el {formatDate(groupStats.createdDate)}
            </Text>
          </View>

          {/* Estadísticas del grupo */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>📊 Estadísticas</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{groupStats.totalMembers}</Text>
                <Text style={styles.statLabel}>Miembros</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{groupStats.totalHabits}</Text>
                <Text style={styles.statLabel}>Hábitos Compartidos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{groupStats.totalLists}</Text>
                <Text style={styles.statLabel}>Listas Colaborativas</Text>
              </View>
            </View>
          </View>

          {/* Vista previa de miembros */}
          <View style={styles.membersSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>👥 Miembros ({groupStats.totalMembers})</Text>
              {isModerator && (
                <TouchableOpacity 
                  style={styles.manageButton}
                  onPress={() => onManageMembers(group)}
                >
                  <Text style={styles.manageButtonText}>Gestionar</Text>
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <Text style={styles.loadingText}>Cargando miembros...</Text>
            ) : (
              <View style={styles.membersList}>
                {members.slice(0, 5).map((member) => (
                  <View key={member.id} style={styles.memberItem}>
                    <View style={styles.memberAvatar}>
                      {getAvatarUrl(member.profiles?.avatar_url) ? (
                        <Image
                          source={{ uri: getAvatarUrl(member.profiles.avatar_url) }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarText}>
                            {(member.profiles?.full_name || member.profiles?.username || 'U')[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {member.profiles?.full_name || member.profiles?.username || 'Usuario'}
                      </Text>
                      <Text style={styles.memberUsername}>
                        @{member.profiles?.username || 'usuario'}
                      </Text>
                    </View>
                    <View style={[
                      styles.roleBadge,
                      { backgroundColor: getRoleBadge(member.role).color }
                    ]}>
                      <Text style={styles.roleText}>
                        {getRoleBadge(member.role).text}
                      </Text>
                    </View>
                  </View>
                ))}
                
                {members.length > 5 && (
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={() => onManageMembers(group)}
                  >
                    <Text style={styles.viewAllButtonText}>
                      Ver todos los {groupStats.totalMembers} miembros
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Botones de acción */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>⚙️ Acciones</Text>
            
            {isAdmin && (
              <>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => onEditGroup(group)}
                >
                  <Text style={styles.actionButtonText}>✏️ Editar Grupo</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionButton, styles.dangerButton]}
                  onPress={() => onDeleteGroup(group)}
                >
                  <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
                    🗑️ Eliminar Grupo
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {isModerator && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => onManageMembers(group)}
              >
                <Text style={styles.actionButtonText}>👥 Gestionar Miembros</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  groupInfoSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 10,
    textAlign: 'center',
  },
  groupDescription: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 15,
  },
  createdDate: {
    fontSize: 14,
    color: '#95a5a6',
    fontStyle: 'italic',
  },
  statsSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
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
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 5,
  },
  membersSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  manageButton: {
    backgroundColor: '#3498db',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  manageButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  membersList: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  memberAvatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  memberUsername: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  viewAllButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  viewAllButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButton: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerButton: {
    backgroundColor: '#e74c3c',
  },
  dangerButtonText: {
    color: '#ffffff',
  },
});