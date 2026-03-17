export const OPEN_ONBOARDING_EVENT = 'gfos:open-onboarding';

export function openOnboarding() {
  window.dispatchEvent(new CustomEvent(OPEN_ONBOARDING_EVENT));
}
