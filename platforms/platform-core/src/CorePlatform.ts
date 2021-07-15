import { AnyObject, ExtensibleConfig, Platform } from '@jovotech/framework';
import {
  CorePlatformOutputTemplateConverterStrategy,
  CorePlatformResponse,
} from '@jovotech/output-core';
import { Core } from './Core';
import { CorePlatformRequest } from './CorePlatformRequest';
import { CorePlatformUser } from './CorePlatformUser';

export interface CorePlatformConfig extends ExtensibleConfig {
  type: 'jovo-platform-core' | string;
}

export class CorePlatform extends Platform<
  CorePlatformRequest,
  CorePlatformResponse,
  Core,
  CorePlatformConfig
> {
  // TODO: determine how useful this is and if this is required somewhere
  // Creates a class with the given name that only supports requests with the given type.
  // Allows making new platforms on the fly
  static create(
    name: string,
    type: CorePlatformConfig['type'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): new (...args: any[]) => CorePlatform {
    // workaround to make the anonymous' class name equal to `name`
    const obj = {
      [name]: class extends CorePlatform {
        getDefaultConfig(): CorePlatformConfig {
          return {
            ...super.getDefaultConfig(),
            type,
          };
        }
      },
    };
    return obj[name];
  }

  outputTemplateConverterStrategy = new CorePlatformOutputTemplateConverterStrategy();
  requestClass = CorePlatformRequest;
  jovoClass = Core;
  userClass = CorePlatformUser;

  getDefaultConfig(): CorePlatformConfig {
    return {
      type: 'jovo-platform-core',
    };
  }

  isRequestRelated(request: AnyObject | CorePlatformRequest): boolean {
    return request.version && request.request?.type && request.type === this.config.type;
  }

  isResponseRelated(response: AnyObject | CorePlatformResponse): boolean {
    return (
      response.version &&
      response.output &&
      response.session &&
      response.context &&
      response.type === this.config.type
    );
  }

  finalizeResponse(
    response: CorePlatformResponse,
    corePlatformApp: Core,
  ): CorePlatformResponse | Promise<CorePlatformResponse> {
    response.type = this.config.type;
    response.session.data = corePlatformApp.$session;
    return response;
  }
}
