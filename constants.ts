import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  "optimism": {
    "id": 10,
    "address": "0x4200000000000000000000000000000000000006",
    "value": "0x0",
    "data": "0x95944f36",
    "gas": "0x186A0",
    "color": "#FF0420",
    "description": "Interacts with a common contract on the Optimism network."
  },
  "base": {
    "id": 8453,
    "address": "0x4200000000000000000000000000000000000006",
    "value": "0x0",
    "data": "0x95944f36",
    "gas": "0x186A0",
    "color": "#0052FF",
    "description": "Interacts with a common contract on the Base network."
  },
  "polygon": {
    "id": 137,
    "address": "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
    "value": "0x0",
    "data": "0x06fdde03",
    "gas": "0x186A0",
    "color": "#8247e5",
    "description": "Reads the name of the WETH contract on Polygon."
  },
  "arbitrum": {
    "id": 42161,
    "address": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    "value": "0x0",
    "data": "0x06fdde03",
    "gas": "0x186A0",
    "color": "#28a0f0",
    "description": "Reads the name of the WETH contract on Arbitrum."
  }
};