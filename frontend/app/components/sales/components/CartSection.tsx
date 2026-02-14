import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles';
import { CartItem, Lottery, RecentPlay } from '../types';

interface CartSectionProps {
  cart: CartItem[];
  currency: string;
  totalAmount: number;
  totalPotentialWin: number;
  customerName: string;
  submitting: boolean;
  recentPlaysCount: number;
  onCustomerNameChange: (name: string) => void;
  onEditItem: (item: CartItem) => void;
  onDeleteItem: (id: string) => void;
  onClearCart: () => void;
  onOpenFavorites: () => void;
  onOpenRecent: () => void;
  onSaveFavorite: () => void;
  onSubmit: () => void;
}

export const CartSection: React.FC<CartSectionProps> = ({
  cart,
  currency,
  totalAmount,
  totalPotentialWin,
  customerName,
  submitting,
  recentPlaysCount,
  onCustomerNameChange,
  onEditItem,
  onDeleteItem,
  onClearCart,
  onOpenFavorites,
  onOpenRecent,
  onSaveFavorite,
  onSubmit,
}) => {
  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemContent}>
        <View style={styles.cartItemHeader}>
          <Text style={styles.cartItemLottery}>{item.lotteryName}</Text>
          {item.playTypeName && (
            <View style={styles.cartItemTypeBadge}>
              <Text style={styles.cartItemTypeText}>{item.playTypeName}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cartItemNumbers}>
          {item.numbers.map(n => n.toString().padStart(2, '0')).join(' - ')}
        </Text>
        <View style={styles.cartItemDetails}>
          <Text style={styles.cartItemAmount}>
            {item.currency} {item.amount}
          </Text>
          <Text style={styles.cartItemPotential}>
            Potencial: {item.currency} {item.potentialWin.toLocaleString()}
          </Text>
        </View>
      </View>
      <View style={styles.cartItemActions}>
        <TouchableOpacity
          style={styles.cartItemEdit}
          onPress={() => onEditItem(item)}
        >
          <Ionicons name="pencil" size={16} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cartItemDelete}
          onPress={() => onDeleteItem(item.id)}
        >
          <Ionicons name="trash" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.section}>
      <View style={styles.cartHeader}>
        <Text style={styles.sectionTitle}>
          <Text style={styles.stepNumber}>5</Text> Carrito ({cart.length} jugadas)
        </Text>
        <View style={styles.cartHeaderButtons}>
          <TouchableOpacity
            style={styles.favoritesButton}
            onPress={onOpenFavorites}
          >
            <Ionicons name="star" size={18} color="#f59e0b" />
            <Text style={styles.favoritesButtonText}>Favoritos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.favoritesButton, { backgroundColor: 'rgba(99, 102, 241, 0.2)', marginLeft: 8 }]}
            onPress={onOpenRecent}
          >
            <Ionicons name="time" size={18} color="#6366f1" />
            <Text style={[styles.favoritesButtonText, { color: '#6366f1' }]}>Recientes</Text>
            {recentPlaysCount > 0 && (
              <View style={styles.recentBadge}>
                <Text style={styles.recentBadgeText}>{recentPlaysCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          {cart.length > 0 && (
            <TouchableOpacity onPress={onClearCart}>
              <Text style={styles.clearCartText}>Vaciar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {cart.length > 0 ? (
        <>
          <FlatList
            data={cart}
            renderItem={renderCartItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />

          {/* Save as Favorite Button */}
          <TouchableOpacity
            style={styles.saveFavoriteButton}
            onPress={onSaveFavorite}
          >
            <Ionicons name="star-outline" size={20} color="#f59e0b" />
            <Text style={styles.saveFavoriteText}>Guardar como Favorito</Text>
          </TouchableOpacity>

          {/* Customer Name */}
          <View style={styles.customerSection}>
            <Text style={styles.customerLabel}>Nombre del cliente (opcional)</Text>
            <TextInput
              style={styles.customerInput}
              value={customerName}
              onChangeText={onCustomerNameChange}
              placeholder="Nombre"
              placeholderTextColor="#64748b"
            />
          </View>

          {/* Totals */}
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total a Pagar:</Text>
              <Text style={styles.totalValue}>{currency} {totalAmount.toLocaleString()}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Premio Potencial:</Text>
              <Text style={[styles.totalValue, styles.totalWin]}>
                {currency} {totalPotentialWin.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={submitting}
            data-testid="submit-sale-btn"
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
                <Text style={styles.submitButtonText}>Crear Boleto ({cart.length} jugadas)</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyCart}>
          <Ionicons name="cart-outline" size={48} color="#475569" />
          <Text style={styles.emptyCartText}>
            El carrito está vacío. Agrega jugadas para crear un boleto.
          </Text>
        </View>
      )}
    </View>
  );
};

export default CartSection;
