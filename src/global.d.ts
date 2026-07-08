// Globals attached at runtime by SearchModal.astro's inline script and used
// by the Navbar trigger and the CommandPalette island. Optional because they
// only exist once that script has run.
interface Window {
    openSearchModal?: () => void;
    closeSearchModal?: () => void;
}
