import {
  DynamicEntitiesMode,
  DynamicEntity,
  mergeInstances,
  MessageValue,
  OutputTemplate,
  OutputTemplateConverterStrategyConfig,
  QuickReplyValue,
  SingleResponseOutputTemplateConverterStrategy,
} from '@jovotech/output';
import { QUICK_REPLIES_MAX_SIZE, QUICK_REPLY_MAX_LENGTH, TEXT_MAX_LENGTH } from './constants';
import {
  DialogflowResponse,
  EntityOverrideMode,
  EntityOverrideModeLike,
  SessionEntityType,
  Text,
} from './models';

// TODO CHECK: Theoretically, multiple messages are supported in the response, in the future this could be refactored for that.
export class DialogflowOutputTemplateConverterStrategy extends SingleResponseOutputTemplateConverterStrategy<
  DialogflowResponse,
  OutputTemplateConverterStrategyConfig
> {
  platformName = 'Dialogflow';
  responseClass = DialogflowResponse;

  prepareOutput(output: OutputTemplate | OutputTemplate[]): OutputTemplate {
    const singleOutput = super.prepareOutput(output);

    if (singleOutput.platforms?.Dialogflow?.message) {
      singleOutput.platforms.Dialogflow.message = this.sanitizeMessage(
        singleOutput.platforms.Dialogflow.message,
        'platforms.Dialogflow.message',
      );
    } else if (singleOutput.message) {
      singleOutput.message = this.sanitizeMessage(singleOutput.message, 'message');
    }

    if (singleOutput.platforms?.Dialogflow?.quickReplies) {
      singleOutput.platforms.Dialogflow.quickReplies = this.sanitizeQuickReplies(
        singleOutput.platforms.Dialogflow.quickReplies,
        'platforms.Dialogflow.quickReplies',
      );
    } else if (singleOutput.quickReplies) {
      singleOutput.quickReplies = this.sanitizeQuickReplies(
        singleOutput.quickReplies,
        'quickReplies',
      );
    }

    return singleOutput;
  }

  protected sanitizeMessage(
    message: MessageValue,
    path: string,
    maxLength = TEXT_MAX_LENGTH,
    offset?: number,
  ): MessageValue {
    return super.sanitizeMessage(message, path, maxLength, offset);
  }

  private sanitizeQuickReplies(quickReplies: QuickReplyValue[], path: string): QuickReplyValue[] {
    if (!this.shouldSanitize('maxSize') || quickReplies.length <= QUICK_REPLIES_MAX_SIZE) {
      return quickReplies;
    }
    quickReplies = quickReplies.slice(0, QUICK_REPLIES_MAX_SIZE);
    this.logArrayTruncationWarning(path, QUICK_REPLIES_MAX_SIZE);
    if (!this.shouldSanitize('maxLength')) {
      return quickReplies;
    }
    return quickReplies.map((quickReply, index) => {
      const quickReplyTextLength =
        typeof quickReply === 'string' ? quickReply.length : quickReply.text.length;
      if (quickReplyTextLength <= QUICK_REPLY_MAX_LENGTH) {
        return quickReply;
      }
      if (typeof quickReply === 'object') {
        quickReply.text = quickReply.text.slice(0, QUICK_REPLY_MAX_LENGTH);
      } else {
        quickReply = quickReply.slice(0, QUICK_REPLY_MAX_LENGTH);
      }
      this.logStringTruncationWarning(`${path}[${index}]`, QUICK_REPLY_MAX_LENGTH);
      return quickReply;
    });
  }

  toResponse(output: OutputTemplate): DialogflowResponse {
    const response: DialogflowResponse = {};

    const listen = output.platforms?.Dialogflow?.listen ?? output.listen;
    if (typeof listen === 'object' && listen.entities?.types?.length) {
      const entityOverrideMode: EntityOverrideMode =
        listen.entities.mode === DynamicEntitiesMode.Merge
          ? EntityOverrideMode.Supplement
          : EntityOverrideMode.Override;
      response.session_entity_types = listen.entities.types.map((entity) =>
        this.convertDynamicEntityToSessionEntityType(entity, entityOverrideMode),
      );
    }

    const message = output.platforms?.Dialogflow?.message || output.message;
    if (message) {
      if (!response.fulfillment_messages) {
        response.fulfillment_messages = [];
      }
      response.fulfillment_messages.push({
        message: {
          text: this.convertMessageToText(message),
        },
      });
    }

    const quickReplies = output.platforms?.Dialogflow?.quickReplies || output.quickReplies;
    if (quickReplies?.length) {
      if (!response.fulfillment_messages) {
        response.fulfillment_messages = [];
      }
      response.fulfillment_messages.push({
        message: {
          quick_replies: {
            quick_replies: quickReplies
              .slice(0, QUICK_REPLIES_MAX_SIZE)
              .map(this.convertQuickReplyToDialogflowQuickReply),
          },
        },
      });
    }

    const card = output.platforms?.Dialogflow?.card || output.card;
    if (card) {
      if (!response.fulfillment_messages) {
        response.fulfillment_messages = [];
      }
      response.fulfillment_messages.push({
        message: {
          card: card.toDialogflowCard!(),
        },
      });
    }

    if (output.platforms?.Dialogflow?.nativeResponse) {
      mergeInstances(response, output.platforms.Dialogflow.nativeResponse);
    }

    return response;
  }

  fromResponse(response: DialogflowResponse): OutputTemplate {
    const output: OutputTemplate = {};

    const messageWithText = response.fulfillment_messages?.find((message) => message.message.text);
    if (messageWithText) {
      output.message = messageWithText.message.text?.toMessage?.();
    }

    const messageWithQuickReplies = response.fulfillment_messages?.find(
      (message) => message.message.quick_replies,
    );
    if (messageWithQuickReplies?.message?.quick_replies?.quick_replies?.length) {
      output.quickReplies = messageWithQuickReplies.message.quick_replies.quick_replies;
    }

    const messageWithCard = response.fulfillment_messages?.find((message) => message.message.card);
    if (messageWithCard) {
      output.card = messageWithCard.message.card?.toCard?.();
    }

    if (response.session_entity_types?.length) {
      const mode =
        response.session_entity_types[0].entity_override_mode === EntityOverrideMode.Supplement
          ? DynamicEntitiesMode.Merge
          : DynamicEntitiesMode.Replace;
      output.listen = {
        entities: {
          mode,
          types: response.session_entity_types.map(this.convertSessionEntityTypeToDynamicEntity),
        },
      };
    }

    return output;
  }

  convertMessageToText(message: MessageValue): Text {
    return typeof message === 'string'
      ? { text: [message] }
      : message.toDialogflowText?.() || {
          text: [message.displayText || message.text],
        };
  }

  convertQuickReplyToDialogflowQuickReply(quickReply: QuickReplyValue): string {
    return typeof quickReply === 'string'
      ? quickReply
      : quickReply.toDialogflowQuickReply?.() || quickReply.value || quickReply.text;
  }

  private convertDynamicEntityToSessionEntityType(
    entity: DynamicEntity,
    entityOverrideMode: EntityOverrideModeLike,
  ): SessionEntityType {
    // name usually is a whole path that even includes the session-id, we will have to figure something out for that, but it should not be too complicated.
    return {
      name: entity.name,
      entity_override_mode: entityOverrideMode,
      entities: (entity.values || []).map((entityValue) => ({
        value: entityValue.id || entityValue.value,
        // at least one synonym
        synonyms: [entityValue.value, ...(entityValue.synonyms?.slice() || [])],
      })),
    };
  }

  private convertSessionEntityTypeToDynamicEntity(
    sessionEntityType: SessionEntityType,
  ): DynamicEntity {
    return {
      name: sessionEntityType.name,
      values: sessionEntityType.entities.map((entity) => ({
        id: entity.value,
        value: entity.value,
        synonyms: entity.synonyms.slice(),
      })),
    };
  }
}
