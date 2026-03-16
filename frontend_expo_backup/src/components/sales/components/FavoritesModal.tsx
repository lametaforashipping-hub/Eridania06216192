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
import { Favorite } from '../types';

interface FavoritesModalProps {
  visible: boolean;
  onClose: () => void;
  favorites: Favorite[];
  onUseFavorite: (favorite: Favorite) => void;
  onDeleteFavorite: (favorite: Favorite) => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  visible,
  onClose,
  favorites,
  onUseFavorite,
  onDeleteFavorite,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>⭐ Mis Favoritos</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.favoritesListContainer}>
            {favorites.length > 0 ? (
              favorites.map(fav => (
                <View key={fav.id} style={styles.favoriteItem}>
                  <TouchableOpacity
                    style={styles.favoriteItemContent}
                    onPress={() => onUseFavorite(fav)}
                  >
                    <View style={styles.favoriteItemHeader}>
                      <Text style={styles.favoriteItemName}>{fav.name}</Text>
                      <Text style={styles.favoriteItemUses}>Usado {fav.use_count}x</Text>
                    </View>
                    <Text style={styles.favoriteItemPlays}>
                      {fav.plays.length} jugada(s) • {fav.plays.map(p => p.numbers.join('-')).join(', ')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.favoriteDeleteButton}
                    onPress={() => onDeleteFavorite(fav)}
                  >
                    <Ionicons name="trash" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyFavorites}>
                <Ionicons name="star-outline" size={48} color="#475569" />
                <Text style={styles.emptyFavoritesText}>No tienes favoritos</Text>
                <Text style={styles.emptyFavoritesSubtext}>
                  Agrega jugadas al carrito y guárdalas como favorito
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

export default FavoritesModal;
