import { StyleSheet } from 'react-native';
import { isDesktop } from './constants';

export const styles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentDesktop: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  shortcutsHelpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutsHelpButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Section styles
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  stepNumber: {
    backgroundColor: '#22c55e',
    color: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
    fontSize: 14,
    overflow: 'hidden',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  // Lottery selection styles
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  selectAllText: {
    fontSize: 12,
    color: '#22c55e',
    marginLeft: 6,
    fontWeight: '600',
  },
  selectedBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  lotteryChipDisabled: {
    opacity: 0.5,
    backgroundColor: '#1e293b',
  },
  typeFilter: {
    marginBottom: 12,
  },
  typeButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#334155',
    marginRight: 8,
  },
  typeButtonActive: {
    backgroundColor: '#22c55e',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  typeButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  lotteryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lotteryChip: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    minWidth: 140,
    borderWidth: 2,
    borderColor: '#334155',
  },
  lotteryChipSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#14532d20',
  },
  lotteryChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lotteryChipFlag: {
    fontSize: 16,
  },
  lotteryChipName: {
    flex: 1,
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  lotteryChipNameSelected: {
    color: '#22c55e',
  },
  lotteryChipInfo: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  selectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  selectionText: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '500',
  },
  clearSelectionText: {
    fontSize: 13,
    color: '#ef4444',
  },

  // Play type styles
  playTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  playTypeChip: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    minWidth: 150,
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
  },
  playTypeChipSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#14532d20',
  },
  playTypeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  playTypeNameSelected: {
    color: '#22c55e',
  },
  playTypeNumbers: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  playTypeMultipliers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  playTypeMultiplier: {
    fontSize: 11,
    color: '#94a3b8',
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playTypeCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
  },

  // Number input styles
  numberInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  numberInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  addButton: {
    backgroundColor: '#22c55e',
    width: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  randomButton: {
    backgroundColor: '#3b82f6',
    width: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedNumbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 50,
    gap: 8,
  },
  selectedBall: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedBallText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  removeBallIcon: {
    marginLeft: 6,
  },
  noNumbers: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  noLotteryText: {
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },

  // Amount styles
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
  },
  amountInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  addToCartText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Cart styles
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cartHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoritesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  favoritesButtonText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  recentBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  recentBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  clearCartText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  cartItemContent: {
    flex: 1,
  },
  cartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cartItemLottery: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  cartItemTypeBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  cartItemTypeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  cartItemNumbers: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 4,
  },
  cartItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartItemAmount: {
    fontSize: 14,
    color: '#94a3b8',
  },
  cartItemPotential: {
    fontSize: 12,
    color: '#64748b',
  },
  cartItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cartItemEdit: {
    padding: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  cartItemDelete: {
    padding: 8,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },
  saveFavoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  saveFavoriteText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  customerSection: {
    marginTop: 16,
  },
  customerLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  customerInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 2,
    borderColor: '#334155',
  },

  // Totals styles
  totalsCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  totalWin: {
    color: '#22c55e',
  },

  // Submit button
  submitButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyCartText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 8,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
  },
  modalContentDesktop: {
    maxWidth: 600,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalCloseButton: {
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    margin: 16,
    marginTop: 8,
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Ticket modal styles
  ticketModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    padding: 16,
  },
  ticketHeader: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  ticketSuccess: {
    fontSize: 48,
    marginBottom: 8,
  },
  ticketTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
  },
  ticketViewShot: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  ticketContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    minWidth: 280,
    maxWidth: 280,
    alignSelf: 'center',
  },
  ticketHeaderSection: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  ticketLogo: {
    width: 60,
    height: 60,
    marginBottom: 8,
    borderRadius: 8,
  },
  ticketCompanyName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
  },
  ticketCompanyInfo: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'center',
    marginTop: 2,
  },
  ticketDivider: {
    height: 1,
    backgroundColor: '#000000',
    marginVertical: 12,
  },
  ticketNumberSection: {
    alignItems: 'center',
    marginVertical: 8,
  },
  ticketNumberLabel: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  ticketNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },
  ticketDateSection: {
    alignItems: 'center',
    marginVertical: 8,
  },
  ticketDate: {
    fontSize: 11,
    color: '#475569',
  },
  ticketCustomer: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '600',
    marginTop: 4,
  },
  ticketPlaysSection: {
    marginVertical: 8,
  },
  ticketPlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  ticketPlayType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
    width: 30,
  },
  ticketPlayNumbers: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  ticketPlayAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    width: 60,
    textAlign: 'right',
  },
  ticketTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  ticketTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  ticketTotalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  ticketQRSection: {
    alignItems: 'center',
    marginVertical: 12,
  },
  ticketFooterSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  ticketFooterText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  ticketActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  ticketActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  ticketActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  textShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
    gap: 6,
  },
  textShareButtonText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  closeTicketButton: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  closeTicketButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Favorites modal styles
  favoritesModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  favoritesListContainer: {
    padding: 16,
    maxHeight: 400,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  favoriteItemContent: {
    flex: 1,
    padding: 14,
  },
  favoriteItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  favoriteItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  favoriteItemUses: {
    fontSize: 12,
    color: '#64748b',
  },
  favoriteItemPlays: {
    fontSize: 13,
    color: '#94a3b8',
  },
  favoriteDeleteButton: {
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  emptyFavorites: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyFavoritesText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyFavoritesSubtext: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },

  // Save favorite modal styles
  saveFavoriteModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  saveFavoriteForm: {
    padding: 16,
  },
  saveFavoriteLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  saveFavoriteInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 12,
  },
  saveFavoriteInfo: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    textAlign: 'center',
  },
  saveFavoriteSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  saveFavoriteSubmitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Recent plays modal styles
  recentSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    padding: 12,
    paddingTop: 0,
  },
  recentPlayItem: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  recentPlayTouchable: {
    padding: 14,
  },
  recentPlayContent: {
    gap: 6,
  },
  recentPlayNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  recentPlayNumbersText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  recentPlayTypeBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentPlayTypeText: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '500',
  },
  recentPlayInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentPlayLottery: {
    fontSize: 13,
    color: '#94a3b8',
  },
  recentPlayAmount: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
  },

  // Edit cart modal styles
  editCartModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  editCartForm: {
    padding: 16,
  },
  editCartInfo: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  editCartLottery: {
    fontSize: 14,
    color: '#94a3b8',
  },
  editCartLotteryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 4,
  },
  editCartLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 12,
  },
  editNumbersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  editNumberBall: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  editRemoveIcon: {
    marginLeft: 6,
  },
  editNumberInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  editNumberInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  editAddNumberButton: {
    backgroundColor: '#22c55e',
    width: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  editAmountInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  editQuickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  editQuickAmountButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editQuickAmountText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editPotentialWin: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editPotentialLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  editPotentialValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
  },
  editSaveButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  editSaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Shortcuts help modal styles
  shortcutsModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '90%',
    maxWidth: 450,
    maxHeight: '80%',
  },
  shortcutsListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  shortcutsSection: {
    marginBottom: 20,
  },
  shortcutsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  shortcutKey: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
    minWidth: 40,
    alignItems: 'center',
  },
  shortcutKeyWide: {
    minWidth: 90,
  },
  shortcutKeyText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  shortcutDesc: {
    color: '#cbd5e1',
    fontSize: 14,
    flex: 1,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
});
