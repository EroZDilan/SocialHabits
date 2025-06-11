import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function ListsScreen() {
  // Accedemos al usuario autenticado para todas las funcionalidades de lista
  const { user, profile } = useAuth();
  
  // Estados para manejar listas y elementos de lista
  const [collaborativeLists, setCollaborativeLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [listItems, setListItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para creación de nuevas listas
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  
  // Estados para añadir elementos a listas
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemContent, setNewItemContent] = useState('');

  // Función para cargar todas las listas colaborativas de los grupos del usuario
  const loadCollaborativeLists = async () => {
    if (!user) {
      console.log('Listas: No hay usuario autenticado');
      return;
    }

    try {
      console.log('Listas: Cargando listas colaborativas para usuario:', user.email);

      // Primero obtenemos los grupos donde el usuario es miembro
      const { data: userGroupMemberships, error: membershipError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (membershipError) {
        console.error('Error al cargar membresías de grupos:', membershipError);
        return;
      }

      if (!userGroupMemberships || userGroupMemberships.length === 0) {
        console.log('Usuario no pertenece a ningún grupo');
        setCollaborativeLists([]);
        return;
      }

      const groupIds = userGroupMemberships.map(m => m.group_id);
      console.log('Listas: Buscando listas en grupos:', groupIds);

      // Cargamos todas las listas colaborativas de esos grupos
      const { data: lists, error: listsError } = await supabase
        .from('collaborative_lists')
        .select(`
          *,
          groups (
            id,
            name
          ),
          profiles:created_by (
            username,
            full_name
          ),
          list_items (
            id,
            content,
            is_completed,
            completed_by,
            created_at
          )
        `)
        .in('group_id', groupIds)
        .order('created_at', { ascending: false });

      if (listsError) {
        console.error('Error al cargar listas colaborativas:', listsError);
        Alert.alert('Error', 'No se pudieron cargar las listas. Intenta nuevamente.');
        return;
      }

      console.log(`Listas: Cargadas ${lists?.length || 0} listas colaborativas`);
      setCollaborativeLists(lists || []);

    } catch (error) {
      console.error('Error inesperado al cargar listas:', error);
      Alert.alert('Error', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Función para cargar grupos donde el usuario puede crear listas (grupos donde es miembro)
  const loadUserGroups = async () => {
    if (!user) return;

    try {
      const { data: memberships, error } = await supabase
        .from('group_members')
        .select(`
          groups (
            id,
            name,
            description
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error al cargar grupos del usuario:', error);
        return;
      }

      const groups = memberships?.map(m => m.groups) || [];
      setUserGroups(groups);
      console.log('Listas: Grupos cargados para crear listas:', groups.length);

    } catch (error) {
      console.error('Error inesperado al cargar grupos:', error);
    }
  };

  // Función para crear una nueva lista colaborativa
  const createCollaborativeList = async () => {
    if (!newListName.trim() || !selectedGroupId) {
      Alert.alert('Error', 'Por favor completa el nombre de la lista y selecciona un grupo.');
      return;
    }

    try {
      console.log('Listas: Creando nueva lista colaborativa...');

      const listData = {
        name: newListName.trim(),
        description: newListDescription.trim() || null,
        group_id: selectedGroupId,
        created_by: user.id
      };

      const { data: newList, error } = await supabase
        .from('collaborative_lists')
        .insert(listData)
        .select(`
          *,
          groups (
            id,
            name
          ),
          profiles:created_by (
            username,
            full_name
          )
        `)
        .single();

      if (error) {
        console.error('Error al crear lista:', error);
        Alert.alert('Error', 'No se pudo crear la lista. Intenta nuevamente.');
        return;
      }

      console.log('Listas: Lista creada exitosamente:', newList);

      // Añadimos la nueva lista a nuestro estado local
      setCollaborativeLists(currentLists => [{ ...newList, list_items: [] }, ...currentLists]);

      // Limpiamos el formulario y cerramos el modal
      setNewListName('');
      setNewListDescription('');
      setSelectedGroupId(null);
      setShowCreateListModal(false);

      Alert.alert(
        'Lista Creada',
        `"${newList.name}" ha sido creada exitosamente. Ahora los miembros del grupo pueden añadir elementos.`,
        [{ text: 'Genial!', style: 'default' }]
      );

    } catch (error) {
      console.error('Error inesperado al crear lista:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    }
  };

  // Función para añadir un elemento a una lista colaborativa
  const addListItem = async () => {
    if (!newItemContent.trim() || !selectedList) {
      Alert.alert('Error', 'Por favor escribe el contenido del elemento.');
      return;
    }

    try {
      console.log('Listas: Añadiendo elemento a lista:', selectedList.name);

      const itemData = {
        list_id: selectedList.id,
        content: newItemContent.trim(),
        created_by: user.id,
        is_completed: false
      };

      const { data: newItem, error } = await supabase
        .from('list_items')
        .insert(itemData)
        .select()
        .single();

      if (error) {
        console.error('Error al añadir elemento:', error);
        Alert.alert('Error', 'No se pudo añadir el elemento. Intenta nuevamente.');
        return;
      }

      console.log('Listas: Elemento añadido exitosamente:', newItem);

      // Actualizamos el estado local inmediatamente
      setListItems(currentItems => [newItem, ...currentItems]);

      // También actualizamos la lista en collaborativeLists
      setCollaborativeLists(currentLists => 
        currentLists.map(list => 
          list.id === selectedList.id 
            ? { ...list, list_items: [newItem, ...list.list_items] }
            : list
        )
      );

      // Limpiamos el campo y cerramos el modal
      setNewItemContent('');
      setShowAddItemModal(false);

    } catch (error) {
      console.error('Error inesperado al añadir elemento:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    }
  };

  // Función para marcar/desmarcar un elemento de lista como completado
  const toggleItemCompletion = async (item) => {
    try {
      console.log('Listas: Cambiando estado de completación:', item.content);

      const newCompletionState = !item.is_completed;
      
      const { error } = await supabase
        .from('list_items')
        .update({ 
          is_completed: newCompletionState,
          completed_by: newCompletionState ? user.id : null,
          completed_at: newCompletionState ? new Date().toISOString() : null
        })
        .eq('id', item.id);

      if (error) {
        console.error('Error al actualizar elemento:', error);
        Alert.alert('Error', 'No se pudo actualizar el elemento. Intenta nuevamente.');
        return;
      }

      // Actualizamos el estado local
      setListItems(currentItems => 
        currentItems.map(listItem => 
          listItem.id === item.id 
            ? { 
                ...listItem, 
                is_completed: newCompletionState,
                completed_by: newCompletionState ? user.id : null 
              }
            : listItem
        )
      );

      // También actualizamos collaborativeLists
      setCollaborativeLists(currentLists => 
        currentLists.map(list => 
          list.id === selectedList?.id 
            ? {
                ...list,
                list_items: list.list_items.map(listItem => 
                  listItem.id === item.id 
                    ? { 
                        ...listItem, 
                        is_completed: newCompletionState,
                        completed_by: newCompletionState ? user.id : null 
                      }
                    : listItem
                )
              }
            : list
        )
      );

    } catch (error) {
      console.error('Error inesperado al actualizar elemento:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    }
  };

  // Función para abrir una lista específica y ver sus elementos
  const openList = (list) => {
    console.log('Listas: Abriendo lista:', list.name);
    setSelectedList(list);
    setListItems(list.list_items || []);
  };

  // Función para cerrar la vista de lista específica
  const closeList = () => {
    setSelectedList(null);
    setListItems([]);
  };

  // Efectos para cargar datos cuando el componente se monta
  useEffect(() => {
    if (user) {
      loadCollaborativeLists();
      loadUserGroups();
    }
  }, [user]);

  // Función para manejar pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadCollaborativeLists();
  };

  // Renderizado de pantalla de carga
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando listas colaborativas...</Text>
      </View>
    );
  }

  // Renderizado de vista de lista específica
  if (selectedList) {
    return (
      <View style={styles.container}>
        {/* Header de la lista específica */}
        <View style={styles.listHeader}>
          <TouchableOpacity onPress={closeList} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <View style={styles.listHeaderInfo}>
            <Text style={styles.listTitle}>{selectedList.name}</Text>
            <Text style={styles.listGroup}>📍 {selectedList.groups.name}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => setShowAddItemModal(true)}
            style={styles.addItemButton}
          >
            <Text style={styles.addItemButtonText}>+ Añadir</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de elementos */}
        <ScrollView style={styles.itemsContainer}>
          {listItems.length === 0 ? (
            <View style={styles.emptyItemsState}>
              <Text style={styles.emptyItemsEmoji}>📝</Text>
              <Text style={styles.emptyItemsTitle}>Lista vacía</Text>
              <Text style={styles.emptyItemsDescription}>
                Sé el primero en añadir elementos a esta lista colaborativa
              </Text>
            </View>
          ) : (
            listItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.listItemCard,
                  item.is_completed && styles.completedItemCard
                ]}
                onPress={() => toggleItemCompletion(item)}
                activeOpacity={0.7}
              >
                <View style={styles.itemContent}>
                  <View style={styles.itemCheckbox}>
                    <Text style={styles.checkboxText}>
                      {item.is_completed ? '✅' : '⬜'}
                    </Text>
                  </View>
                  <View style={styles.itemText}>
                    <Text style={[
                      styles.itemContentText,
                      item.is_completed && styles.completedItemText
                    ]}>
                      {item.content}
                    </Text>
                    {item.is_completed && item.completed_by === user.id && (
                      <Text style={styles.completedByText}>Completado por ti</Text>
                    )}
                    {item.is_completed && item.completed_by !== user.id && (
                      <Text style={styles.completedByText}>Completado por otro miembro</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Modal para añadir nuevo elemento */}
        <Modal
          visible={showAddItemModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddItemModal(false)}
        >
          <KeyboardAvoidingView 
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddItemModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Añadir Elemento</Text>
              <TouchableOpacity onPress={addListItem}>
                <Text style={styles.modalSaveText}>Añadir</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <TextInput
                style={styles.itemInput}
                value={newItemContent}
                onChangeText={setNewItemContent}
                placeholder="Escribe el elemento de la lista..."
                multiline={true}
                numberOfLines={3}
                autoFocus={true}
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  // Renderizado principal de listas colaborativas
  return (
    <View style={styles.container}>
      {/* Header principal */}
      <View style={styles.header}>
        <Text style={styles.title}>Listas Colaborativas</Text>
        <Text style={styles.subtitle}>Coordina tareas con tus grupos</Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#f39c12']}
            tintColor="#f39c12"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Lista de listas colaborativas */}
        {collaborativeLists.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📋</Text>
            <Text style={styles.emptyStateTitle}>¡Crea tu primera lista!</Text>
            <Text style={styles.emptyStateDescription}>
              Las listas colaborativas te ayudan a coordinar tareas con tu grupo en tiempo real
            </Text>
          </View>
        ) : (
          collaborativeLists.map((list) => (
            <TouchableOpacity
              key={list.id}
              style={styles.listCard}
              onPress={() => openList(list)}
              activeOpacity={0.7}
            >
              <View style={styles.listCardHeader}>
                <Text style={styles.listName}>{list.name}</Text>
                <Text style={styles.listItemCount}>
                  {list.list_items?.filter(item => item.is_completed).length || 0}/
                  {list.list_items?.length || 0} completados
                </Text>
              </View>
              {list.description && (
                <Text style={styles.listDescription}>{list.description}</Text>
              )}
              <View style={styles.listMeta}>
                <Text style={styles.listGroup}>📍 {list.groups.name}</Text>
                <Text style={styles.listCreator}>
                  Por: {list.profiles?.full_name || list.profiles?.username || 'Usuario'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Botón para crear nueva lista */}
        <TouchableOpacity 
          style={styles.createListButton}
          onPress={() => setShowCreateListModal(true)}
        >
          <Text style={styles.createListButtonText}>➕ Crear Nueva Lista</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal para crear nueva lista */}
      <Modal
        visible={showCreateListModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateListModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateListModal(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nueva Lista</Text>
            <TouchableOpacity onPress={createCollaborativeList}>
              <Text style={styles.modalSaveText}>Crear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Nombre de la Lista *</Text>
              <TextInput
                style={styles.textInput}
                value={newListName}
                onChangeText={setNewListName}
                placeholder="ej. Compras para la cena, Tareas del proyecto..."
                maxLength={100}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Descripción (Opcional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={newListDescription}
                onChangeText={setNewListDescription}
                placeholder="Describe el propósito de esta lista..."
                multiline={true}
                numberOfLines={3}
                maxLength={300}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Seleccionar Grupo *</Text>
              {userGroups.map(group => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupOption,
                    selectedGroupId === group.id && styles.selectedGroupOption
                  ]}
                  onPress={() => setSelectedGroupId(group.id)}
                >
                  <Text style={[
                    styles.groupOptionText,
                    selectedGroupId === group.id && styles.selectedGroupOptionText
                  ]}>
                    {group.name}
                  </Text>
                  {selectedGroupId === group.id && (
                    <Text style={styles.selectedIndicator}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff3e0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
  },
  loadingText: {
    fontSize: 18,
    color: '#f39c12',
    marginTop: 10,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f39c12',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#8d5524',
    textAlign: 'center',
    marginTop: 5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
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
    color: '#f39c12',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#8d5524',
    textAlign: 'center',
    lineHeight: 20,
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d68910',
    flex: 1,
  },
  listItemCount: {
    fontSize: 12,
    color: '#b7950b',
    backgroundColor: '#fef9e7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  listDescription: {
    fontSize: 14,
    color: '#8d5524',
    marginBottom: 8,
  },
  listMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listGroup: {
    fontSize: 12,
    color: '#a6721b',
  },
  listCreator: {
    fontSize: 11,
    color: '#85651d',
    fontStyle: 'italic',
  },
  createListButton: {
    backgroundColor: '#f39c12',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  createListButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos para vista de lista específica
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1c40f',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#e67e22',
    fontSize: 16,
    fontWeight: '500',
  },
  listHeaderInfo: {
    flex: 1,
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d68910',
  },
  listGroup: {
    fontSize: 12,
    color: '#b7950b',
    marginTop: 2,
  },
  addItemButton: {
    backgroundColor: '#f39c12',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  addItemButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemsContainer: {
    flex: 1,
    padding: 20,
  },
  emptyItemsState: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyItemsEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyItemsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 8,
  },
  emptyItemsDescription: {
    fontSize: 16,
    color: '#8d5524',
    textAlign: 'center',
    lineHeight: 22,
  },
  listItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  completedItemCard: {
    backgroundColor: '#f8f9fa',
    opacity: 0.8,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  checkboxText: {
    fontSize: 20,
  },
  itemText: {
    flex: 1,
  },
  itemContentText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 22,
  },
  completedItemText: {
    textDecorationLine: 'line-through',
    color: '#7f8c8d',
  },
  completedByText: {
    fontSize: 12,
    color: '#27ae60',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Estilos para modales
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCancelText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalSaveText: {
    color: '#f39c12',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#2c3e50',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  itemInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#2c3e50',
    height: 100,
    textAlignVertical: 'top',
  },
  groupOption: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedGroupOption: {
    backgroundColor: '#fff3e0',
    borderColor: '#f39c12',
  },
  groupOptionText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  selectedGroupOptionText: {
    color: '#d68910',
    fontWeight: '600',
  },
  selectedIndicator: {
    fontSize: 16,
    color: '#f39c12',
    fontWeight: 'bold',
  },
});