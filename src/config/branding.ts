/** Game title / logo text. Everything user-visible that names the game reads from here. */
export const BRANDING = {
  titleZh: '神墜',
  titleEn: 'Divine Fall',
  tagline: '神明隕落之後，碎片仍在低語',
  /** Used for document.title and the loading screen. */
  get documentTitle(): string {
    return `${this.titleZh} ${this.titleEn}`;
  },
} as const;
