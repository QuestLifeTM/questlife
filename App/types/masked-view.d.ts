// masked-view 0.3.2 references NativeMethods, removed by React Native 0.88.
// Preserve its public props while the package adopts the strict native API.
declare module "@react-native-masked-view/masked-view" {
  import type { ComponentType, ReactElement } from "react";
  import type { ViewProps } from "react-native";
  const MaskedView: ComponentType<ViewProps & {
    maskElement: ReactElement;
    androidRenderingMode?: "software" | "hardware";
  }>;
  export default MaskedView;
}
