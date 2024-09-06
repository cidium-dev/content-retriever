import {encodingForModel} from 'js-tiktoken';
import {countTokens} from '@anthropic-ai/tokenizer';

export enum AnthropicChatModel {
  HAIKU = 'claude-3-haiku-20240307',
  SONNET = 'claude-3-5-sonnet-20240620',
  OPUS = 'claude-3-opus-20240229',
}

export enum OpenAIChatModel {
  GPT4OMini = 'gpt-4o-mini',
  GPT4O = 'gpt-4o',
}

export enum ChatModel {
  SONNET = 'claude-3-5-sonnet-20240620',
  GPT4OMini = 'gpt-4o-mini',
  GPT4O = 'gpt-4o',
}

export const getTokenCount = (str: string, model = ChatModel.GPT4O) => {
  if ((Object.values(OpenAIChatModel) as string[]).includes(model)) {
    return encodingForModel(model as unknown as OpenAIChatModel).encode(str)
      .length;
  } else {
    return countTokens(str);
  }
};
