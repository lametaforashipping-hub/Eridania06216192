import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles';
import { isDesktop } from '../constants';

interface ShortcutsHelpModalProps {
  visible: boolean;
  onClose: () => void;
}

interface Shortcut {
  key: string;
  description: string;
  wide?: boolean;
}

interface ShortcutSection {
  title: string;
  shortcuts: Shortcut[];
}

const SHORTCUTS: ShortcutSection[] = [
  {
    title: 'Tipo de Jugada',
    shortcuts: [
      { key: 'F1', description: 'Seleccionar Quiniela' },
      { key: 'F2', description: 'Seleccionar Pale' },
      { key: 'F3', description: 'Seleccionar Tripleta' },
      { key: 'F4', description: 'Seleccionar Super Pale' },
    ],
  },
  {
    title: 'Navegación',
    shortcuts: [
      { key: 'N', description: 'Enfocar campo de número' },
      { key: 'M', description: 'Enfocar campo de monto' },
      { key: 'A', description: 'Seleccionar/Deseleccionar todas las loterías' },
    ],
  },
  {
    title: 'Números',
    shortcuts: [
      { key: 'R', description: 'Números aleatorios (Quick Pick)' },
      { key: 'Backspace', description: 'Borrar último número', wide: true },
      { key: 'Esc', description: 'Limpiar números / Cerrar modal' },
    ],
  },
  {
    title: 'Acciones',
    shortcuts: [
      { key: 'Enter', description: 'Agregar jugada al carrito' },
      { key: 'Ctrl+Enter', description: 'Procesar venta', wide: true },
      { key: 'X / Delete', description: 'Vaciar carrito', wide: true },
    ],
  },
  {
    title: 'Acceso Rápido',
    shortcuts: [
      { key: 'F', description: 'Abrir favoritos' },
      { key: 'H', description: 'Abrir jugadas recientes' },
      { key: '?', description: 'Mostrar esta ayuda' },
    ],
  },
];

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  visible,
  onClose,
}) => {
  // Only show on web
  if (Platform.OS !== 'web') return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.shortcutsModalContent, isDesktop && styles.modalContentDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>⌨️ Atajos de Teclado</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.shortcutsListContainer}>
            {SHORTCUTS.map((section, sIndex) => (
              <View key={sIndex} style={styles.shortcutsSection}>
                <Text style={styles.shortcutsSectionTitle}>{section.title}</Text>
                {section.shortcuts.map((shortcut, index) => (
                  <View key={index} style={styles.shortcutRow}>
                    <View style={[styles.shortcutKey, shortcut.wide && styles.shortcutKeyWide]}>
                      <Text style={styles.shortcutKeyText}>{shortcut.key}</Text>
                    </View>
                    <Text style={styles.shortcutDesc}>{shortcut.description}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ShortcutsHelpModal;
