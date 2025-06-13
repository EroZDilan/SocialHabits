import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  RefreshControl
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function GroupMembersModal({ 
  visible, 
  onClose, 
  group, 
  userRole 
}) {
  const { user } = useAuth();
  
  // Estados para gestión de miembros
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);

  // Función para cargar todos los miembros del grupo
  const loadGroupMembers = async () => {
    if (!group) return;

    setLoading(true);
    try {
      console.log('👥 Cargando miembros completos del grupo:', group.name);

      const { data: membersData, error } = await supabase
        .from('group_members')
        .select(`
          id,
          role,
          joined_at,
          user_id,
          profiles:user_id (
            username,
            full_name,
            avatar_url,
            bio
          )
        `)
        .eq('group_id', group.id)
        .order('role', { ascending: true }) // Admins primero
        .order('joined_at', { ascending: true }); // Luego por antigüedad

      if (error) {
        console.error('Error cargando miembros:', error);
        Alert.alert('Error', 'No se pudieron cargar los miembros del grupo.');
        return;
      }

      console.log(`👥 Cargados ${membersData?.length || 0} miembros`);
      setMembers(membersData || []);

    } catch (error) {
      console.error('Error inesperado cargando miembros:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Función para promover a un miembro
  const promoteMember = async (member, newRole) => {
    const roleNames = {
      admin: 'Administrador',
      moderator: 'Moderador',
      member: 'Miembro'
    };

    Alert.alert(
      'Cambiar Rol',
      `¿Estás seguro de que quieres cambiar el rol de ${member.profiles?.full_name || member.profiles?.username} a ${roleNames[newRole]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar',
          style: 'default',
          onPress: () => confirmPromoteMember(member, newRole)
        }
      ]
    );
  };

  // Función que ejecuta el cambio de rol
  const confirmPromoteMember = async (member, newRole) => {
    setProcessingAction(member.id);

    try {
      console.log(`👥 Cambiando rol de ${member.profiles?.username} a ${newRole}`);

      const { error } = await supabase
        .from('group_members')
        .update({ role: newRole })
        .eq('id', member.id)
        .eq('group_id', group.id);

      if (error) {
        console.error('Error cambiando rol:', error);
        Alert.alert('Error', 'No se pudo cambiar el rol del miembro.');
        return;
      }

      console.log('✅ Rol cambiado exitosamente');

      // Actualizamos la lista local
      setMembers(currentMembers =>
        currentMembers.map(m =>
          m.id === member.id ? { ...m, role: newRole } : m
        ).sort((a, b) => {
          // Reordenamos: admins primero, luego por fecha
          if (a.role !== b.role) {
            const roleOrder = { admin: 0, moderator: 1, member: 2 };
            return roleOrder[a.role] - roleOrder[b.role];
          }
          return new Date(a.joined_at) - new Date(b.joined_at);
        })
      );

      const roleNames = {
        admin: 'administrador',
        moderator: 'moderador',
        member: 'miembro'
      };

      Alert.alert(
        'Rol Actualizado',
        `${member.profiles?.full_name || member.profiles?.username} ahora es ${roleNames[newRole]} del grupo.`
      );

    } catch (error) {
      console.error('Error inesperado cambiando rol:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado.');
    } finally {
      setProcessingAction(null);
    }
  };

  // Función para expulsar a un miembro
  const removeMember = async (member) => {
    if (member.user_id === user.id) {
      Alert.alert('Error', 'No puedes expulsarte a ti mismo. Usa la opción "Abandonar Grupo" en su lugar.');
      return;
    }

    Alert.alert(
      'Expulsar Miembro',
      `¿Estás seguro de que quieres expulsar a ${member.profiles?.full_name || member.profiles?.username} del grupo?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Expulsar',
          style: 'destructive',
          onPress: () => confirmRemoveMember(member)
        }
      ]
    );
  };

  // Función que ejecuta la expulsión
  const confirmRemoveMember = async (member) => {
    setProcessingAction(member.id);

    try {
      console.log(`👥 Expulsando a ${member.profiles?.username} del grupo`);

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', member.id)
        .eq('group_id', group.id);

      if (error) {
        console.error('Error expulsando miembro:', error);
        Alert.alert('Error', 'No se pudo expulsar al miembro.');
        return;
      }

      console.log('✅ Miembro expulsado exitosamente');

      // Removemos de la lista local
      setMembers(currentMembers =>
        currentMembers.filter(m => m.id !== member.id)
      );

      Alert.alert(
        'Miembro Expulsado',
        `${member.profiles?.full_name || member.profiles?.username} ha sido expulsado del grupo.`
      );

    } catch (error) {
      console.error('Error inesperado expulsando miembro:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado.');
    } finally {
      setProcessingAction(null);
    }
  };

  // Función para mostrar opciones de un miembro
  const showMemberOptions = (member) => {
    if (member.user_id === user.id) {
      Alert.alert('Tu Perfil', 'No puedes gestionar tu propio perfil desde aquí.');
      return;
    }

    const isTargetAdmin = member.role === 'admin';
    const canPromote = userRole === 'admin' && member.role !== 'admin';
    const canDemote = userRole === 'admin' && member.role !== 'member';
    const canRemove = (userRole === 'admin' || userRole === 'moderator') && !isTargetAdmin;

    const options = [];

    // Opciones de promoción/degradación
    if (canPromote) {
      if (member.role === 'member') {
        options.push({
          text: '⬆️ Promover a Moderador',
          onPress: () => promoteMember(member, 'moderator')
        });
        options.push({
          text: '⬆️⬆️ Promover a Admin',
          onPress: () => promoteMember(member, 'admin')
        });
      } else if (member.role === 'moderator') {
        options.push({
          text: '⬆️ Promover a Admin',
          onPress: () => promoteMember(member, 'admin')
        });
      }
    }

    if (canDemote) {
      if (member.role === 'admin') {
        options.push({
          text: '⬇️ Degradar a Moderador',
          onPress: () => promoteMember(member, 'moderator')
        });
        options.push({
          text: '⬇️⬇️ Degradar a Miembro',
          onPress: () => promoteMember(member, 'member')
        });
      } else if (member.role === 'moderator') {
        options.push({
          text: '⬇️ Degradar a Miembro',
          onPress: () => promoteMember(member, 'member')
        });
      }
    }

    // Opción de expulsión
    if (canRemove) {
      options.push({
        text: '🚫 Expulsar del Grupo',
        style: 'destructive',
        onPress: () => removeMember(member)
      });
    }

    options.push({
      text: 'Cancelar',
      style: 'cancel'
    });

    if (options.length === 1) {
      Alert.alert('Sin Opciones', 'No tienes permisos para gestionar este miembro.');
      return;
    }

    Alert.alert(
      member.profiles?.full_name || member.profiles?.username || 'Miembro',
      'Selecciona una acción:',
      options
    );
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

  // Función para obtener badge de rol
  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return { text: 'Admin', color: '#e74c3c', icon: '👑' };
      case 'moderator':
        return { text: 'Mod', color: '#f39c12', icon: '⭐' };
      default:
        return { text: 'Miembro', color: '#3498db', icon: '👤' };
    }
  };

  // Función para formatear fecha de unión
  const formatJoinDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Función para manejar pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadGroupMembers();
  };

  // Efecto para cargar miembros cuando se abre el modal
  useEffect(() => {
    if (visible && group) {
      loadGroupMembers();
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
          <Text style={styles.title}>Gestionar Miembros</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Información del grupo */}
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.memberCount}>
            {members.length} miembro{members.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando miembros...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#27ae60']}
                tintColor="#27ae60"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {members.map((member) => {
              const roleBadge = getRoleBadge(member.role);
              const isProcessing = processingAction === member.id;
              const isCurrentUser = member.user_id === user.id;

              return (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.memberCard,
                    isCurrentUser && styles.currentUserCard,
                    isProcessing && styles.processingCard
                  ]}
                  onPress={() => !isProcessing && showMemberOptions(member)}
                  disabled={isProcessing}
                  activeOpacity={0.7}
                >
                  <View style={styles.memberContent}>
                    {/* Avatar */}
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
                      {isCurrentUser && (
                        <View style={styles.currentUserBadge}>
                          <Text style={styles.currentUserBadgeText}>Tú</Text>
                        </View>
                      )}
                    </View>

                    {/* Información del miembro */}
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {member.profiles?.full_name || member.profiles?.username || 'Usuario'}
                      </Text>
                      <Text style={styles.memberUsername}>
                        @{member.profiles?.username || 'usuario'}
                      </Text>
                      {member.profiles?.bio && (
                        <Text style={styles.memberBio} numberOfLines={1}>
                          {member.profiles.bio}
                        </Text>
                      )}
                      <Text style={styles.joinDate}>
                        Se unió el {formatJoinDate(member.joined_at)}
                      </Text>
                    </View>

                    {/* Badge de rol */}
                    <View style={styles.memberRole}>
                      <View style={[
                        styles.roleBadge,
                        { backgroundColor: roleBadge.color }
                      ]}>
                        <Text style={styles.roleIcon}>{roleBadge.icon}</Text>
                        <Text style={styles.roleText}>{roleBadge.text}</Text>
                      </View>
                      
                      {isModerator && !isCurrentUser && (
                        <View style={styles.actionIndicator}>
                          <Text style={styles.actionIndicatorText}>
                            {isProcessing ? '⏳' : '⚙️'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Información sobre permisos */}
            <View style={styles.permissionsInfo}>
              <Text style={styles.permissionsTitle}>ℹ️ Información de Roles</Text>
              <Text style={styles.permissionsText}>
                • <Text style={styles.adminText}>👑 Administradores</Text>: Pueden gestionar todos los aspectos del grupo
              </Text>
              <Text style={styles.permissionsText}>
                • <Text style={styles.modText}>⭐ Moderadores</Text>: Pueden gestionar miembros y contenido
              </Text>
              <Text style={styles.permissionsText}>
                • <Text style={styles.memberText}>👤 Miembros</Text>: Pueden participar en hábitos y listas
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
  groupInfo: {
    backgroundColor: '#27ae60',
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  memberCount: {
    fontSize: 14,
    color: '#d5f4e6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  memberCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentUserCard: {
    borderWidth: 2,
    borderColor: '#3498db',
  },
  processingCard: {
    opacity: 0.6,
  },
  memberContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  memberAvatar: {
    position: 'relative',
    marginRight: 15,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  currentUserBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  currentUserBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  memberUsername: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  memberBio: {
    fontSize: 12,
    color: '#95a5a6',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  joinDate: {
    fontSize: 10,
    color: '#bdc3c7',
  },
  memberRole: {
    alignItems: 'center',
    gap: 5,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  roleIcon: {
    fontSize: 12,
  },
  roleText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIndicatorText: {
    fontSize: 10,
  },
  permissionsInfo: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    marginBottom: 30,
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2980b9',
    marginBottom: 10,
  },
  permissionsText: {
    fontSize: 12,
    color: '#34495e',
    lineHeight: 18,
    marginBottom: 4,
  },
  adminText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  modText: {
    color: '#f39c12',
    fontWeight: 'bold',
  },
  memberText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
});