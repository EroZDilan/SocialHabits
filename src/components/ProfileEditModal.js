import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileEditModal({ visible, onClose, onSave, currentProfile }) {
  // Accedemos al usuario autenticado
  const { user } = useAuth();
  
  // Estados para todos los campos editables del perfil
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  
  // Estados para configuraciones de privacidad
  const [publicStats, setPublicStats] = useState({
    show_total_habits: true,
    show_current_streaks: true,
    show_best_streaks: false,
    show_achievements: true,
    show_groups: true
  });
  
  const [privacySettings, setPrivacySettings] = useState({
    profile_visibility: 'public',
    show_in_search: true,
    allow_group_invitations: true,
    show_online_status: false
  });
  
  // Estados para control de la interfaz
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Estados para validación
  const [usernameError, setUsernameError] = useState('');
  const [websiteError, setWebsiteError] = useState('');

  // Función para inicializar el formulario con datos existentes
  const initializeForm = () => {
    if (currentProfile) {
      setUsername(currentProfile.username || '');
      setFullName(currentProfile.full_name || '');
      setBio(currentProfile.bio || '');
      setLocation(currentProfile.location || '');
      setWebsite(currentProfile.website || '');
      setAvatarUri(currentProfile.avatar_url || null);
      
      // Inicializamos configuraciones con valores por defecto si no existen
      setPublicStats({
        show_total_habits: true,
        show_current_streaks: true,
        show_best_streaks: false,
        show_achievements: true,
        show_groups: true,
        ...currentProfile.public_stats
      });
      
      setPrivacySettings({
        profile_visibility: 'public',
        show_in_search: true,
        allow_group_invitations: true,
        show_online_status: false,
        ...currentProfile.privacy_settings
      });
    }
  };

  // Función para validar username único
  const validateUsername = async (newUsername) => {
    if (!newUsername.trim()) {
      setUsernameError('El nombre de usuario es requerido');
      return false;
    }

    if (newUsername.length < 3) {
      setUsernameError('Mínimo 3 caracteres');
      return false;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setUsernameError('Solo letras, números y guiones bajos');
      return false;
    }

    // Solo validamos unicidad si el username cambió
    if (newUsername !== currentProfile?.username) {
      const { data: existingUser, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', newUsername.toLowerCase())
        .neq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error verificando username:', error);
        setUsernameError('Error verificando disponibilidad');
        return false;
      }

      if (existingUser) {
        setUsernameError('Este nombre de usuario ya existe');
        return false;
      }
    }

    setUsernameError('');
    return true;
  };

  // Función para validar formato de website
  const validateWebsite = (url) => {
    if (!url.trim()) {
      setWebsiteError('');
      return true;
    }

    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlPattern.test(url)) {
      setWebsiteError('URL inválida');
      return false;
    }

    setWebsiteError('');
    return true;
  };

  // Función para seleccionar imagen de avatar
  const pickImage = async () => {
    try {
      // Pedimos permisos para acceder a la galería
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permisos Requeridos',
          'Necesitamos acceso a tu galería para cambiar tu foto de perfil.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      // Configuramos las opciones del picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Relación 1:1 para avatar cuadrado
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('📷 Imagen seleccionada:', imageUri);
        await uploadAvatar(imageUri);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen. Intenta nuevamente.');
    }
  };

  // Función para subir avatar a Supabase Storage
  const uploadAvatar = async (imageUri) => {
    setUploadingAvatar(true);

    try {
      // Creamos un nombre único para el archivo
      const fileExt = imageUri.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      console.log('📤 Subiendo avatar:', fileName);

      // Convertimos la imagen a FormData
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: `image/${fileExt}`,
        name: fileName,
      });

      // Subimos la imagen a Supabase Storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error('Error subiendo avatar:', error);
        Alert.alert('Error', 'No se pudo subir la imagen. Intenta nuevamente.');
        return;
      }

      console.log('✅ Avatar subido exitosamente:', data.path);

      // Actualizamos el estado local con la nueva imagen
      setAvatarUri(data.path);

      Alert.alert(
        'Foto Actualizada',
        'Tu foto de perfil se actualizará cuando guardes los cambios.',
        [{ text: 'OK', style: 'default' }]
      );

    } catch (error) {
      console.error('Error inesperado subiendo avatar:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error al subir la imagen.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Función para guardar todos los cambios del perfil
  const handleSave = async () => {
    console.log('💾 Guardando cambios de perfil...');

    // Validamos los campos antes de guardar
    const isUsernameValid = await validateUsername(username);
    const isWebsiteValid = validateWebsite(website);

    if (!isUsernameValid || !isWebsiteValid) {
      console.log('❌ Validación falló');
      return;
    }

    setSaving(true);

    try {
      // Preparamos los datos actualizados
      const updatedProfile = {
        username: username.toLowerCase().trim(),
        full_name: fullName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        avatar_url: avatarUri || null,
        public_stats: publicStats,
        privacy_settings: privacySettings,
        updated_at: new Date().toISOString(),
      };

      console.log('📤 Actualizando perfil con:', updatedProfile);

      // Actualizamos el perfil en la base de datos
      const { error } = await supabase
        .from('profiles')
        .update(updatedProfile)
        .eq('id', user.id);

      if (error) {
        console.error('Error actualizando perfil:', error);
        
        if (error.code === '23505') {
          Alert.alert('Error', 'El nombre de usuario ya está en uso.');
        } else {
          Alert.alert('Error', 'No se pudo actualizar el perfil. Intenta nuevamente.');
        }
        return;
      }

      console.log('✅ Perfil actualizado exitosamente');

      // Notificamos al componente padre
      if (onSave) {
        await onSave();
      }

      // Cerramos el modal
      onClose();

      Alert.alert(
        'Perfil Actualizado',
        'Tus cambios se han guardado exitosamente.',
        [{ text: 'Perfecto', style: 'default' }]
      );

    } catch (error) {
      console.error('Error inesperado guardando perfil:', error);
      Alert.alert('Error Inesperado', 'Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  // Función para manejar el cierre del modal con confirmación
  const handleClose = () => {
    const hasChanges = 
      username !== (currentProfile?.username || '') ||
      fullName !== (currentProfile?.full_name || '') ||
      bio !== (currentProfile?.bio || '') ||
      location !== (currentProfile?.location || '') ||
      website !== (currentProfile?.website || '') ||
      avatarUri !== currentProfile?.avatar_url;

    if (hasChanges) {
      Alert.alert(
        'Descartar Cambios',
        '¿Estás seguro de que quieres cerrar? Se perderán los cambios no guardados.',
        [
          { text: 'Continuar Editando', style: 'cancel' },
          { 
            text: 'Descartar',
            style: 'destructive',
            onPress: () => {
              initializeForm();
              onClose();
            }
          }
        ]
      );
    } else {
      onClose();
    }
  };

  // Función para obtener URL de avatar para previsualización
  const getAvatarPreviewUrl = () => {
    if (!avatarUri) return null;
    
    if (avatarUri.startsWith('http')) {
      return avatarUri;
    }
    
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(avatarUri);
    
    return data.publicUrl;
  };

  // Función para alternar configuración de estadísticas públicas
  const togglePublicStat = (key) => {
    setPublicStats(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Función para alternar configuración de privacidad
  const togglePrivacySetting = (key) => {
    setPrivacySettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Inicializamos el formulario cuando se abre el modal
  useEffect(() => {
    if (visible) {
      initializeForm();
    }
  }, [visible, currentProfile]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header del modal */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>Editar Perfil</Text>
          
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Sección de foto de perfil */}
          <View style={styles.avatarSection}>
            <Text style={styles.sectionTitle}>Foto de Perfil</Text>
            
            <View style={styles.avatarContainer}>
              {getAvatarPreviewUrl() ? (
                <Image
                  source={{ uri: getAvatarPreviewUrl() }}
                  style={styles.avatarPreview}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {(fullName || username || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={[styles.changeAvatarButton, uploadingAvatar && styles.disabledButton]} 
                onPress={pickImage}
                disabled={uploadingAvatar}
              >
                <Text style={styles.changeAvatarButtonText}>
                  {uploadingAvatar ? '⏳ Subiendo...' : '📷 Cambiar Foto'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sección de información personal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Personal</Text>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Nombre de Usuario *</Text>
              <TextInput
                style={[styles.textInput, usernameError ? styles.inputError : null]}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (usernameError) setUsernameError('');
                }}
                placeholder="tu_nombre_usuario"
                maxLength={30}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
              <Text style={styles.helperText}>
                Solo letras, números y guiones bajos. Será visible como @{username}
              </Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Nombre Completo</Text>
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Tu nombre completo"
                maxLength={100}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Biografía</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Cuéntanos sobre ti, tus objetivos y lo que te motiva..."
                maxLength={300}
                multiline={true}
                numberOfLines={4}
                autoCapitalize="sentences"
              />
              <Text style={styles.helperText}>
                {bio.length}/300 caracteres
              </Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Ubicación</Text>
              <TextInput
                style={styles.textInput}
                value={location}
                onChangeText={setLocation}
                placeholder="Ciudad, País"
                maxLength={100}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Sitio Web</Text>
              <TextInput
                style={[styles.textInput, websiteError ? styles.inputError : null]}
                value={website}
                onChangeText={(text) => {
                  setWebsite(text);
                  if (websiteError) setWebsiteError('');
                }}
                placeholder="https://tu-sitio-web.com"
                maxLength={200}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {websiteError ? <Text style={styles.errorText}>{websiteError}</Text> : null}
            </View>
          </View>

          {/* Configuraciones de estadísticas públicas */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estadísticas Públicas</Text>
            <Text style={styles.sectionDescription}>
              Controla qué estadísticas pueden ver otros miembros de tus grupos
            </Text>
            
            <View style={styles.switchContainer}>
              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Mostrar Total de Hábitos</Text>
                  <Text style={styles.switchDescription}>Número de hábitos activos</Text>
                </View>
                <Switch
                  value={publicStats.show_total_habits}
                  onValueChange={() => togglePublicStat('show_total_habits')}
                  trackColor={{ false: '#e0e0e0', true: '#3498db' }}
                  thumbColor={publicStats.show_total_habits ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Mostrar Rachas Actuales</Text>
                  <Text style={styles.switchDescription}>Hábitos con rachas activas</Text>
                </View>
                <Switch
                  value={publicStats.show_current_streaks}
                  onValueChange={() => togglePublicStat('show_current_streaks')}
                  trackColor={{ false: '#e0e0e0', true: '#3498db' }}
                  thumbColor={publicStats.show_current_streaks ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Mostrar Mejor Racha</Text>
                  <Text style={styles.switchDescription}>Tu récord personal más alto</Text>
                </View>
                <Switch
                  value={publicStats.show_best_streaks}
                  onValueChange={() => togglePublicStat('show_best_streaks')}
                  trackColor={{ false: '#e0e0e0', true: '#3498db' }}
                  thumbColor={publicStats.show_best_streaks ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Mostrar Logros</Text>
                  <Text style={styles.switchDescription}>Achievements y badges ganados</Text>
                </View>
                <Switch
                  value={publicStats.show_achievements}
                  onValueChange={() => togglePublicStat('show_achievements')}
                  trackColor={{ false: '#e0e0e0', true: '#3498db' }}
                  thumbColor={publicStats.show_achievements ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Mostrar Grupos</Text>
                  <Text style={styles.switchDescription}>Cantidad de grupos activos</Text>
                </View>
                <Switch
                  value={publicStats.show_groups}
                  onValueChange={() => togglePublicStat('show_groups')}
                  trackColor={{ false: '#e0e0e0', true: '#3498db' }}
                  thumbColor={publicStats.show_groups ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>
          </View>

          {/* Configuraciones de privacidad */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configuraciones de Privacidad</Text>
            <Text style={styles.sectionDescription}>
              Controla cómo otros usuarios pueden encontrarte e interactuar contigo
            </Text>
            
            <View style={styles.switchContainer}>
              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Aparecer en Búsquedas</Text>
                  <Text style={styles.switchDescription}>Otros pueden encontrarte por username</Text>
                </View>
                <Switch
                  value={privacySettings.show_in_search}
                  onValueChange={() => togglePrivacySetting('show_in_search')}
                  trackColor={{ false: '#e0e0e0', true: '#27ae60' }}
                  thumbColor={privacySettings.show_in_search ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Permitir Invitaciones a Grupos</Text>
                  <Text style={styles.switchDescription}>Otros pueden invitarte a sus grupos</Text>
                </View>
                <Switch
                  value={privacySettings.allow_group_invitations}
                  onValueChange={() => togglePrivacySetting('allow_group_invitations')}
                  trackColor={{ false: '#e0e0e0', true: '#27ae60' }}
                  thumbColor={privacySettings.allow_group_invitations ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Mostrar Estado Online</Text>
                  <Text style={styles.switchDescription}>Otros ven cuándo estás activo</Text>
                </View>
                <Switch
                  value={privacySettings.show_online_status}
                  onValueChange={() => togglePrivacySetting('show_online_status')}
                  trackColor={{ false: '#e0e0e0', true: '#27ae60' }}
                  thumbColor={privacySettings.show_online_status ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>
          </View>

          {/* Información sobre la privacidad */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>🔐 Sobre tu Privacidad</Text>
            <Text style={styles.infoText}>
              Estas configuraciones te dan control total sobre tu información. Puedes cambiarlas 
              en cualquier momento.
            </Text>
            <Text style={styles.infoText}>
              Tu información nunca se comparte fuera de la aplicación, y solo los miembros 
              de tus grupos pueden ver las estadísticas que elijas compartir.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  saveButton: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  avatarSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#3498db',
    marginBottom: 15,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarPlaceholderText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  changeAvatarButton: {
    backgroundColor: '#3498db',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  changeAvatarButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  section: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 15,
    lineHeight: 18,
  },
  fieldContainer: {
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
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 5,
  },
  helperText: {
    color: '#7f8c8d',
    fontSize: 12,
    marginTop: 5,
    lineHeight: 16,
  },
  switchContainer: {
    gap: 15,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 15,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 12,
    color: '#7f8c8d',
    lineHeight: 16,
  },
  infoSection: {
    backgroundColor: '#e8f4fd',
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