import {encodingForModel} from 'js-tiktoken';
import {countTokens} from '@anthropic-ai/tokenizer';

export enum AnthropicChatModel {
  HAIKU = 'claude-3-haiku-20240307',
  SONNET = 'claude-3-sonnet-20240229',
  OPUS = 'claude-3-opus-20240229',
}

export enum OpenAIChatModel {
  GPT3 = 'gpt-3.5-turbo-1106',
  GPT4 = 'gpt-4-turbo-preview',
}

export enum ChatModel {
  HAIKU = 'claude-3-haiku-20240307',
  SONNET = 'claude-3-sonnet-20240229',
  OPUS = 'claude-3-opus-20240229',
  GPT3 = 'gpt-3.5-turbo-1106',
  GPT4 = 'gpt-4-turbo-preview',
}

export const getTokenCount = (str: string, model = ChatModel.GPT4) => {
  if ((Object.values(OpenAIChatModel) as string[]).includes(model)) {
    return encodingForModel(model as unknown as OpenAIChatModel).encode(str)
      .length;
  } else {
    return countTokens(str);
  }
};
