import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles';
import { isDesktop } from '../constants';

interface SaveFavoriteModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  cartLength: number;
}

export const SaveFavoriteModal: React.FC<SaveFavoriteModalProps> = ({
  visible,
  onClose,
  onSave,
  cartLength,
}) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim());
      setName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.saveFavoriteModalContent, isDesktop && styles.modalContentDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>⭐ Guardar Favorito</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <View style={styles.saveFavoriteForm}>
            <Text style={styles.saveFavoriteLabel}>Nombre del favorito:</Text>
            <TextInput
              style={styles.saveFavoriteInput}
              value={name}
              onChangeText={setName}
              placeholder="Ej: Don Pedro - 25"
              placeholderTextColor="#64748b"
              autoFocus
            />
            <Text style={styles.saveFavoriteInfo}>
              Se guardarán {cartLength} jugadas del carrito
            </Text>
            <TouchableOpacity
              style={[styles.saveFavoriteSubmit, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="star" size={20} color="#ffffff" />
                  <Text style={styles.saveFavoriteSubmitText}>Guardar Favorito</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SaveFavoriteModal;
