import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  RefreshControl
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import GroupCreationModal from '../components/GroupCreationModal';

export default function SocialHubScreen() {
  // Accedemos al usuario autenticado para todas las funcionalidades sociales
  const { user, profile } = useAuth();
  
  // Estados para manejar los datos sociales del usuario
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados existentes para campos del formulario...
const [restDaysPerWeek, setRestDaysPerWeek] = useState(0);

// Nuevos estados para funcionalidad de grupos
const [selectedGroupId, setSelectedGroupId] = useState(null);
const [isShared, setIsShared] = useState(false);
const [loadingGroups, setLoadingGroups] = useState(false);

// Estados existentes para validación...
const [saving, setSaving] = useState(false);
  
  // Estados para manejar estadísticas sociales agregadas
  const [socialStats, setSocialStats] = useState({
    totalGroups: 0,
    totalFriends: 0,
    sharedHabits: 0,
    collaborativeLists: 0
  });

  // Estado para el modal de creación de grupos
  const [showGroupCreationModal, setShowGroupCreationModal] = useState(false);

  // Función para cargar todos los grupos donde el usuario es miembro
  // Esta función establece la base para todas las funcionalidades sociales
  const loadUserGroups = async () => {
    if (!user) {
      console.log('Social Hub: No hay usuario autenticado');
      return;
    }

    try {
      console.log('Social Hub: Cargando grupos para usuario:', user.email);

      // Consultamos todos los grupos donde el usuario es miembro
      // Esta consulta utiliza un JOIN para obtener información completa del grupo y membresía
      const { data: groupMemberships, error: groupsError } = await supabase
        .from('group_members')
        .select(`
          id,
          role,
          joined_at,
          groups (
            id,
            name,
            description,
            created_at,
            profiles:created_by (
              username,
              full_name
            )
          )
        `)
        .eq('user_id', user.id);

      if (groupsError) {
        console.error('Error al cargar grupos:', groupsError);
        Alert.alert('Error', 'No se pudieron cargar tus grupos. Intenta nuevamente.');
        return;
      }

      console.log('Social Hub: Grupos cargados:', groupMemberships?.length || 0);

      // Procesamos los datos para calcular estadísticas agregadas
      const processedGroups = groupMemberships || [];
      
      // Calculamos estadísticas sociales básicas
      const stats = {
        totalGroups: processedGroups.length,
        totalFriends: await calculateTotalFriends(processedGroups),
        sharedHabits: await calculateSharedHabits(),
        collaborativeLists: await calculateCollaborativeLists(processedGroups)
      };

      setUserGroups(processedGroups);
      setSocialStats(stats);
      console.log('Social Hub: Estadísticas sociales calculadas:', stats);

    } catch (error) {
      console.error('Error inesperado al cargar grupos:', error);
      Alert.alert('Error', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Función para calcular el número total de amigos únicos en todos los grupos
  const calculateTotalFriends = async (groups) => {
    if (!groups || groups.length === 0) return 0;

    try {
      // Obtenemos todos los miembros de todos los grupos donde participamos
      const groupIds = groups.map(g => g.groups.id);
      
      const { data: allMembers, error } = await supabase
        .from('group_members')
        .select('user_id')
        .in('group_id', groupIds)
        .neq('user_id', user.id); // Excluimos al usuario actual

      if (error) {
        console.error('Error al calcular amigos:', error);
        return 0;
      }

      // Contamos usuarios únicos para evitar duplicados en múltiples grupos
      const uniqueFriends = new Set(allMembers?.map(m => m.user_id) || []);
      return uniqueFriends.size;

    } catch (error) {
      console.error('Error inesperado al calcular amigos:', error);
      return 0;
    }
  };

  // Función para calcular cuántos hábitos está compartiendo el usuario
  const calculateSharedHabits = async () => {
    try {
      // Contamos hábitos que están asignados a grupos (hábitos compartidos)
      const { data: sharedHabits, error } = await supabase
        .from('habits')
        .select('id')
        .eq('user_id', user.id)
        .not('group_id', 'is', null);

      if (error) {
        console.error('Error al calcular hábitos compartidos:', error);
        return 0;
      }

      return sharedHabits?.length || 0;

    } catch (error) {
      console.error('Error inesperado al calcular hábitos compartidos:', error);
      return 0;
    }
  };

  // Función para calcular el número de listas colaborativas en los grupos del usuario
  const calculateCollaborativeLists = async (groups) => {
    if (!groups || groups.length === 0) return 0;

    try {
      const groupIds = groups.map(g => g.groups.id);
      
      const { data: lists, error } = await supabase
        .from('collaborative_lists')
        .select('id')
        .in('group_id', groupIds);

      if (error) {
        console.error('Error al calcular listas colaborativas:', error);
        return 0;
      }

      return lists?.length || 0;

    } catch (error) {
      console.error('Error inesperado al calcular listas:', error);
      return 0;
    }
  };

  // Función para abrir el modal de creación de grupos
  const openGroupCreationModal = () => {
    console.log('Social Hub: Abriendo modal de creación de grupos');
    setShowGroupCreationModal(true);
  };

  // Función para cerrar el modal de creación de grupos
  const closeGroupCreationModal = () => {
    console.log('Social Hub: Cerrando modal de creación de grupos');
    setShowGroupCreationModal(false);
  };

  // Función callback que se ejecuta cuando se crea exitosamente un nuevo grupo
  const handleGroupCreated = async (newGroup) => {
    console.log('Social Hub: Grupo creado exitosamente:', newGroup.name);
    
    try {
      // Creamos el objeto de membresía que refleja que el usuario actual es administrador del nuevo grupo
      const newMembership = {
        id: `temp-${Date.now()}`, // ID temporal para la interfaz local
        role: 'admin',
        joined_at: new Date().toISOString(),
        groups: {
          id: newGroup.id,
          name: newGroup.name,
          description: newGroup.description,
          created_at: newGroup.created_at,
          profiles: {
            username: profile?.username || user?.email,
            full_name: profile?.full_name || 'Usuario'
          }
        }
      };

      // Añadimos el nuevo grupo a la lista local inmediatamente
      setUserGroups(currentGroups => [newMembership, ...currentGroups]);
      
      // Recalculamos las estadísticas sociales
      setSocialStats(currentStats => ({
        ...currentStats,
        totalGroups: currentStats.totalGroups + 1
      }));

      console.log('Social Hub: Interfaz actualizada localmente con el nuevo grupo');

      // Recargamos los datos completos desde la base de datos para asegurar sincronización
      setTimeout(() => {
        console.log('Social Hub: Recargando datos desde la base de datos para sincronización');
        loadUserGroups();
      }, 1000);

    } catch (error) {
      console.error('Social Hub: Error al actualizar la interfaz después de crear grupo:', error);
      await loadUserGroups();
    }
  };

  // Función para iniciar el proceso de creación de un nuevo grupo
  const createNewGroup = () => {
    console.log('Social Hub: Usuario solicitó crear nuevo grupo');
    openGroupCreationModal();
  };

  // Función para unirse a un grupo existente
  const joinGroup = () => {
    Alert.alert(
      'Unirse a Grupo',
      'La funcionalidad para unirse a grupos se implementará próximamente.',
      [{ text: 'Entendido', style: 'default' }]
    );
  };

  // Función para mostrar las opciones disponibles para un grupo específico
  const showGroupOptions = (membership) => {
    const group = membership.groups;
    const isAdmin = membership.role === 'admin';
    
    console.log('Social Hub: Mostrando opciones para grupo:', group.name, 'Rol:', membership.role);
    
    const options = [
      {
        text: 'Ver Detalles',
        onPress: () => viewGroupDetails(group)
      }
    ];

    if (isAdmin) {
      options.push({
        text: 'Gestionar Miembros',
        onPress: () => manageGroupMembers(group)
      });
      options.push({
        text: 'Editar Grupo',
        onPress: () => editGroup(group)
      });
    }

    options.push({
      text: 'Abandonar Grupo',
      style: 'destructive',
      onPress: () => leaveGroup(membership)
    });

    options.push({
      text: 'Cancelar',
      style: 'cancel'
    });

    Alert.alert(group.name, 'Elige una acción:', options);
  };

  // Función placeholder para ver detalles del grupo
  const viewGroupDetails = (group) => {
    Alert.alert(
      'Detalles del Grupo',
      `Grupo: ${group.name}\n\nDescripción: ${group.description || 'Sin descripción'}\n\nEsta funcionalidad se expandirá para mostrar miembros, hábitos compartidos, y estadísticas del grupo.`,
      [{ text: 'Entendido', style: 'default' }]
    );
  };

  // Función placeholder para gestionar miembros
  const manageGroupMembers = (group) => {
    Alert.alert(
      'Gestionar Miembros',
      'La funcionalidad de gestión de miembros se implementará en el siguiente paso, incluyendo invitaciones y gestión de roles.',
      [{ text: 'Entendido', style: 'default' }]
    );
  };

  // Función placeholder para editar grupo
  const editGroup = (group) => {
    Alert.alert(
      'Editar Grupo',
      'La funcionalidad de edición de grupos se implementará próximamente.',
      [{ text: 'Entendido', style: 'default' }]
    );
  };

  // Función para abandonar un grupo con confirmación apropiada
  const leaveGroup = (membership) => {
    const group = membership.groups;
    const isAdmin = membership.role === 'admin';
    
    let message = `¿Estás seguro de que quieres abandonar "${group.name}"?`;
    
    if (isAdmin) {
      message += '\n\nComo administrador, abandonar el grupo requerirá transferir la administración a otro miembro o el grupo se eliminará si eres el único miembro.';
    }
    
    Alert.alert(
      'Abandonar Grupo',
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Abandonar', 
          style: 'destructive',
          onPress: () => confirmLeaveGroup(membership)
        }
      ]
    );
  };

  // Función que ejecuta el proceso de abandonar el grupo
  const confirmLeaveGroup = async (membership) => {
    console.log('Social Hub: Procesando abandono del grupo:', membership.groups.name);
    
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', membership.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Social Hub: Error al abandonar grupo:', error);
        Alert.alert('Error', 'No se pudo abandonar el grupo. Intenta nuevamente.');
        return;
      }

      console.log('Social Hub: Abandono del grupo completado exitosamente');

      // Removemos el grupo de la lista local inmediatamente
      setUserGroups(currentGroups => 
        currentGroups.filter(g => g.id !== membership.id)
      );

      // Actualizamos las estadísticas sociales
      setSocialStats(currentStats => ({
        ...currentStats,
        totalGroups: Math.max(0, currentStats.totalGroups - 1)
      }));

      Alert.alert(
        'Grupo Abandonado',
        `Has abandonado "${membership.groups.name}" exitosamente.`,
        [{ text: 'OK', style: 'default' }]
      );

    } catch (error) {
      console.error('Social Hub: Error inesperado al abandonar grupo:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    }
  };

  // Efecto para cargar datos cuando el componente se monta o el usuario cambia
  // Efecto que inicializa el formulario cuando cambia el hábito en edición
  useEffect(() => {
    if (user) {
      loadUserGroups();
    }
  }, [user]);

  // Función para manejar pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadUserGroups();
  };

  // Renderizado de la pantalla de carga mientras obtenemos datos iniciales
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando tu red social...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header con saludo personalizado */}
      <View style={styles.header}>
        <Text style={styles.title}>Hola, {profile?.username || user?.email}</Text>
        <Text style={styles.subtitle}>Tu red de accountability te está esperando</Text>
      </View>

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
        {/* Panel de estadísticas sociales */}
        <View style={styles.statsPanel}>
          <Text style={styles.statsPanelTitle}>Tu Red Social</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{socialStats.totalGroups}</Text>
              <Text style={styles.statLabel}>Grupos</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{socialStats.totalFriends}</Text>
              <Text style={styles.statLabel}>Amigos</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{socialStats.sharedHabits}</Text>
              <Text style={styles.statLabel}>Hábitos Compartidos</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{socialStats.collaborativeLists}</Text>
              <Text style={styles.statLabel}>Listas Activas</Text>
            </View>
          </View>
        </View>

        {/* Sección de grupos del usuario */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mis Grupos</Text>
          
          {userGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>👥</Text>
              <Text style={styles.emptyStateTitle}>¡Construye tu red de apoyo!</Text>
              <Text style={styles.emptyStateDescription}>
                Los hábitos son más fáciles cuando los compartes. Crea un grupo con amigos 
                o familia para motivarse mutuamente.
              </Text>
            </View>
          ) : (
            userGroups.map((membership) => (
              <TouchableOpacity 
                key={membership.id} 
                style={styles.groupCard}
                onPress={() => showGroupOptions(membership)}
                activeOpacity={0.7}
              >
                <View style={styles.groupHeader}>
                  <Text style={styles.groupName}>{membership.groups.name}</Text>
                  <View style={[
                    styles.roleBadge, 
                    membership.role === 'admin' ? styles.adminBadge : styles.memberBadge
                  ]}>
                    <Text style={styles.roleText}>
                      {membership.role === 'admin' ? 'Admin' : 'Miembro'}
                    </Text>
                  </View>
                </View>
                
                {membership.groups.description && (
                  <Text style={styles.groupDescription}>
                    {membership.groups.description}
                  </Text>
                )}
                
                <Text style={styles.groupCreator}>
                  Creado por: {membership.groups.profiles?.full_name || 'Usuario'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Botones de acción principales */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.primaryActionButton} onPress={createNewGroup}>
            <Text style={styles.actionButtonText}>➕ Crear Grupo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryActionButton} onPress={joinGroup}>
            <Text style={styles.secondaryActionButtonText}>🔗 Unirse a Grupo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de creación de grupos integrado en la pantalla social */}
      <GroupCreationModal
        visible={showGroupCreationModal}
        onClose={closeGroupCreationModal}
        onGroupCreated={handleGroupCreated}
      />
    </View>
  );
}

// Estilos que crean una interfaz social acogedora y funcional
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8f5e8',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27ae60',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#2d5a3d',
    textAlign: 'center',
    marginTop: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
  },
  loadingText: {
    fontSize: 18,
    color: '#27ae60',
    marginTop: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsPanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 15,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadge: {
    backgroundColor: '#e74c3c',
  },
  memberBadge: {
    backgroundColor: '#3498db',
  },
  roleText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  groupDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  groupCreator: {
    fontSize: 12,
    color: '#95a5a6',
    fontStyle: 'italic',
  },
  actionButtons: {
    paddingBottom: 20,
  },
  primaryActionButton: {
    backgroundColor: '#27ae60',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryActionButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  secondaryActionButtonText: {
    color: '#27ae60',
    fontSize: 16,
    fontWeight: 'bold',
  },
});