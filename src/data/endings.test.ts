import { describe, expect, it } from 'vitest'
import { ENDINGS, ENDING_MAP, JUSTICE_EPILOGUE, MAX_ENDING_SECONDS, SILAS_DEFAULT_LINE } from './endings'

describe('endings data', () => {
  it('has Rest and Taken only: Uneasy Peace is retired (Req 17.8)', () => {
    expect(ENDINGS.map((e) => e.id).sort()).toEqual(['rest', 'taken'])
    expect(Object.keys(ENDING_MAP).sort()).toEqual(['rest', 'taken'])
  })

  it('keeps every sequence within the length cap', () => {
    for (const e of ENDINGS) expect(e.duration).toBeLessThanOrEqual(MAX_ENDING_SECONDS)
  })

  it('has the epilogue and the default line worded from the design bible', () => {
    expect(JUSTICE_EPILOGUE.join(' ')).toContain('cart')
    expect(JUSTICE_EPILOGUE.join(' ')).toContain('Bishop')
    expect(SILAS_DEFAULT_LINE).toBe("Silas Vane's cart rolled away at dawn, as it always does.")
  })
})
