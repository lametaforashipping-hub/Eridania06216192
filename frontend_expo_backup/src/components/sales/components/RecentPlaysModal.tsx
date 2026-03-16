import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles';
import { isDesktop } from '../constants';
import { RecentPlay } from '../types';

interface RecentPlaysModalProps {
  visible: boolean;
  onClose: () => void;
  recentPlays: RecentPlay[];
  onUseRecentPlay: (play: RecentPlay) => void;
}

export const RecentPlaysModal: React.FC<RecentPlaysModalProps> = ({
  visible,
  onClose,
  recentPlays,
  onUseRecentPlay,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.favoritesModalContent, isDesktop && styles.modalContentDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🕐 Jugadas Recientes</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.recentSubtitle}>
            Toca una jugada para agregarla al carrito
          </Text>
          <ScrollView style={styles.favoritesListContainer}>
            {recentPlays.length > 0 ? (
              recentPlays.map((play, index) => (
                <View key={play.id || index} style={styles.recentPlayItem}>
                  <TouchableOpacity
                    style={styles.recentPlayTouchable}
                    onPress={() => onUseRecentPlay(play)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.recentPlayContent}>
                      <View style={styles.recentPlayNumbers}>
                        <Text style={styles.recentPlayNumbersText}>
                          {play.numbers.join(' - ')}
                        </Text>
                        <View style={styles.recentPlayTypeBadge}>
                          <Text style={styles.recentPlayTypeText}>
                            {play.lottery_type?.charAt(0).toUpperCase() + play.lottery_type?.slice(1)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.recentPlayInfo}>
                        <Text style={styles.recentPlayLottery}>
                          {play.lottery_name || 'Lotería'}
                        </Text>
                        <Text style={styles.recentPlayAmount}>
                          ${play.amount}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyFavorites}>
                <Ionicons name="time-outline" size={48} color="#475569" />
                <Text style={styles.emptyFavoritesText}>No hay jugadas recientes</Text>
                <Text style={styles.emptyFavoritesSubtext}>
                  Las jugadas que realices aparecerán aquí
                </Text>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default RecentPlaysModal;
