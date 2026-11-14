import { createNavigationContainerRef } from '@react-navigation/native';

/** Lets code outside screens (push handlers) navigate once the container is ready. */
export const navigationRef = createNavigationContainerRef<any>();
