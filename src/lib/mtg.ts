export function getStandardCardImage(scryfallCard: any): string | undefined {
  if (scryfallCard.image_uris?.normal) {
    return scryfallCard.image_uris.normal;
  }
  // Double faced cards
  if (scryfallCard.card_faces && scryfallCard.card_faces[0]?.image_uris?.normal) {
    return scryfallCard.card_faces[0].image_uris.normal;
  }
  return undefined;
}
