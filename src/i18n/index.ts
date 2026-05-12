import type { UiLanguage } from "../types.js";
import type { TranslationFunctions } from "./i18n-types.js";
import { i18nObject } from "./i18n-util.js";
import { loadAllLocales } from "./i18n-util.sync.js";

loadAllLocales();

export function getTranslator(language: UiLanguage = "zh"): TranslationFunctions {
  return i18nObject(language);
}

