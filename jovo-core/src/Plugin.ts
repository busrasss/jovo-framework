import { DeepPartial } from '.';
import { Extensible } from './Extensible';

// eslint-disable-next-line @typescript-eslint/ban-types
export type PluginConstructor<C extends object = object, T extends Plugin<C> = Plugin<C>> = new (
  config: DeepPartial<C>,
) => T;

// eslint-disable-next-line @typescript-eslint/ban-types
export interface PluginDefinition<C extends object = object, T extends Plugin<C> = Plugin<C>> {
  constructor: PluginConstructor<C, T>;
  plugins?: PluginDefinitionInput[];
  config?: C;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type PluginDefinitionInput<C extends object = object, T extends Plugin<C> = Plugin<C>> =
  | PluginConstructor<C, T>
  | PluginDefinition<C, T>;

// eslint-disable-next-line @typescript-eslint/ban-types
export interface Plugin<C extends object = object> {
  readonly config: C;

  getDefaultConfig(): C;

  initialize?(parent: Extensible): Promise<void>;

  install(parent: Extensible): Promise<void> | void;

  uninstall?(parent?: Extensible): Promise<void> | void;
}
