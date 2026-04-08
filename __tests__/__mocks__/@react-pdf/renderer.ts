// Jest mock for @react-pdf/renderer.
// This package uses ESM and cannot be parsed by Jest's CommonJS transformer.
// Tests that import modules depending on this package will use this stub instead.

import React from 'react'

module.exports = {
  renderToBuffer: jest.fn().mockResolvedValue(Buffer.from('')),
  Document: (props: React.HTMLAttributes<HTMLDivElement>) => React.createElement('div', props),
  Page: (props: React.HTMLAttributes<HTMLDivElement>) => React.createElement('div', props),
  View: (props: React.HTMLAttributes<HTMLDivElement>) => React.createElement('div', props),
  Text: (props: React.HTMLAttributes<HTMLSpanElement>) => React.createElement('span', props),
  Image: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Font: {
    register: jest.fn(),
    load: jest.fn(),
  },
  PDFRenderer: {},
  usePDF: jest.fn().mockReturnValue([{ loading: false, url: null }, jest.fn()]),
}
