import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { FR_TRANSLATIONS } from './translations'

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
})

const originalText = new WeakMap()
const originalAttr = new WeakMap()
const translatableAttrs = ('placeholder title aria-label').split(' ')

function translateSource(value) {
  const source = String(value ?? '').trim()
  if (!source) return ''
  const normalized = source.replace(/\s+/g, ' ')
  if (FR_TRANSLATIONS[source]) return FR_TRANSLATIONS[source]
  if (FR_TRANSLATIONS[normalized]) return FR_TRANSLATIONS[normalized]

  const dynamicRules = [
    [/^Search for player a…$/i, () => 'Rechercher le joueur A...'],
    [/^Search for player b…$/i, () => 'Rechercher le joueur B...'],
    [/^Age (\d+)$/, (match) => `Age ${match[1]}`],
    [/^Minimum (\d+) starts$/, (match) => `Minimum ${match[1]} titularisations`],
    [/^Loaded (\d+) ranked profiles$/, (match) => `${match[1]} profils classes charges`],
    [/^(\d+) ranked profiles loaded$/, (match) => `${match[1]} profils classes charges`],
    [/^(\d+) current profiles$/, (match) => `${match[1]} profils actuels`],
    [/^(\d+) high-signal profiles$/, (match) => `${match[1]} profils a fort signal`],
    [/^(\d+) goals$/, (match) => `${match[1]} buts`],
    [/^(\d+) goal contributions$/, (match) => `${match[1]} contributions aux buts`],
    [/^(\d+) chances created$/, (match) => `${match[1]} occasions creees`],
    [/^(\d+) progressive passes$/, (match) => `${match[1]} passes progressives`],
    [/^(\d+) percentile( · (.+))?$/, (match) => `${match[1]}e percentile${match[3] ? ` · ${FR_TRANSLATIONS[match[3]] || match[3]}` : ''}`],
    [/^Scope: 48 World Cup nations$/, () => 'Portee : 48 nations de Coupe du monde'],
    [/^Scope: top leagues \+ domestic cups$/, () => 'Portee : grands championnats + coupes nationales'],
    [/^Current lane:$/, () => 'Selection actuelle :'],
    [/^Select (.+) for comparison$/, (match) => `Selectionner ${match[1]} pour comparaison`],
    [/^Remove from (.+)$/, (match) => `Retirer de ${FR_TRANSLATIONS[match[1]] || match[1]}`],
    [/^Clear (.+)$/, (match) => `Vider ${FR_TRANSLATIONS[match[1]] || match[1]}`],
    [/^No players saved in (.+)$/, (match) => `Aucun joueur enregistre dans ${FR_TRANSLATIONS[match[1]] || match[1]}`],
    [/^This will target (.+)\.$/, (match) => `Cela ciblera ${FR_TRANSLATIONS[match[1]] || match[1]}.`],
  ]

  for (const [pattern, build] of dynamicRules) {
    const match = normalized.match(pattern)
    if (match) return build(match)
  }

  return ''
}

function applyTextNode(node, language) {
  const currentValue = node.nodeValue
  if (!originalText.has(node)) originalText.set(node, currentValue)

  let source = originalText.get(node)
  const sourceTrimmed = source.trim()

  if (language === 'en') {
    const translated = translateSource(sourceTrimmed)
    const translatedValue = translated ? source.replace(sourceTrimmed, translated) : source
    if (translated && currentValue === translatedValue) {
      if (node.nodeValue !== source) node.nodeValue = source
      return
    }
    originalText.set(node, currentValue)
    return
  }

  const translatedSource = translateSource(sourceTrimmed)
  const translatedValue = translatedSource ? source.replace(sourceTrimmed, translatedSource) : source
  if (currentValue !== source && currentValue !== translatedValue) {
    originalText.set(node, currentValue)
    source = currentValue
  }

  const trimmed = source.trim()
  if (!trimmed) return

  const translated = translateSource(trimmed)
  if (!translated) return

  const nextValue = source.replace(trimmed, translated)
  if (node.nodeValue !== nextValue) node.nodeValue = nextValue
}

function applyElementAttrs(element, language) {
  for (const attr of translatableAttrs) {
    if (!element.hasAttribute(attr)) continue
    let stored = originalAttr.get(element)
    if (!stored) {
      stored = {}
      originalAttr.set(element, stored)
    }
    if (!stored[attr]) stored[attr] = element.getAttribute(attr)
    let source = stored[attr]
    const currentValue = element.getAttribute(attr)
    const translatedSource = translateSource(source)
    const translatedValue = translatedSource || source

    if (language === 'en') {
      if (translatedSource && currentValue === translatedValue) {
        if (currentValue !== source) element.setAttribute(attr, source)
        continue
      }
      stored[attr] = currentValue
      continue
    }

    if (currentValue !== source && currentValue !== translatedValue) {
      stored[attr] = currentValue
      source = currentValue
    }

    const translated = translateSource(source)
    const nextValue = translated || source
    if (element.getAttribute(attr) !== nextValue) element.setAttribute(attr, nextValue)
  }
}

function walkAndTranslate(root, language) {
  if (!root) return
  if (root.nodeType === Node.TEXT_NODE) {
    applyTextNode(root, language)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return

  const element = root.nodeType === Node.ELEMENT_NODE ? root : null
  if (element) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) return
    applyElementAttrs(element, language)
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const parent = node.parentElement
    if (parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
      applyTextNode(node, language)
    }
    node = walker.nextNode()
  }

  if (element) {
    element.querySelectorAll('[placeholder], [title], [aria-label]').forEach((child) => {
      applyElementAttrs(child, language)
    })
  }
}

function useDomTranslation(language) {
  useEffect(() => {
    document.documentElement.lang = language
    walkAndTranslate(document.body, language)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          applyTextNode(mutation.target, language)
          continue
        }
        if (mutation.type === 'attributes') {
          applyElementAttrs(mutation.target, language)
          continue
        }
        mutation.addedNodes.forEach((node) => walkAndTranslate(node, language))
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatableAttrs,
    })

    return () => observer.disconnect()
  }, [language])
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem('pitchiq:language') || 'en')

  const setLanguage = (nextLanguage) => {
    const normalized = nextLanguage === 'fr' ? 'fr' : 'en'
    localStorage.setItem('pitchiq:language', normalized)
    setLanguageState(normalized)
  }

  const value = useMemo(() => ({
    language,
    setLanguage,
    toggleLanguage: () => setLanguage(language === 'fr' ? 'en' : 'fr'),
  }), [language])

  useDomTranslation(language)

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
