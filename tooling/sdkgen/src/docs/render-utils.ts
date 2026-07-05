import fs from 'node:fs'
import path from 'node:path'

import ejs from 'ejs'

import type { DocModel } from './model.js'

export function code(value: unknown): string {
    return `\`\`${plain(value).replaceAll('`', '')}\`\``
}

export function plain(value: unknown, fallback = ''): string {
    const text = value == null ? fallback : String(value)
    return text.replace(/\s+/g, ' ').trim() || fallback
}

export function heading(title: string, marker: string): string {
    return `${title}\n${marker.repeat(title.length)}`
}

export function rstDocLink(title: string, pagePath: string): string {
    return `:doc:\`${title} <${pagePath}>\``
}

export function codeList(values: string[], fallback = 'n/a'): string {
    return values.length > 0 ? values.map(value => code(value)).join(', ') : fallback
}

export function markdownCodeList(values: string[], fallback = 'n/a'): string {
    return codeList(values, fallback).replaceAll('``', '`')
}

export function roleMessageCount(model: DocModel): number {
    return model.network.roles.reduce((sum, role) => sum + role.messages.length, 0)
}

export function listTable(headers: string[], rows: string[][]): string {
    const lines = ['.. list-table::', '   :header-rows: 1', '']
    const addRow = (values: string[]) => {
        const [first, ...rest] = values
        lines.push(`   * - ${first || 'n/a'}`)
        for (const value of rest) {
            lines.push(`     - ${value || 'n/a'}`)
        }
    }

    addRow(headers)
    for (const row of rows) addRow(row)
    lines.push('')
    return lines.join('\n')
}

export function markdownTable(headers: string[], rows: string[][]): string {
    const escapeCell = (value: string) => value.replaceAll('|', '\\|').replace(/\s+/g, ' ')
    return [
        `| ${headers.map(escapeCell).join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map(row => `| ${row.map(escapeCell).join(' | ')} |`),
        '',
    ].join('\n')
}

export function htmlEscape(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
}

export function htmlTable(headers: string[], rows: string[][]): string {
    return [
        '<table>',
        '<thead><tr>',
        ...headers.map(header => `<th>${htmlEscape(header)}</th>`),
        '</tr></thead>',
        '<tbody>',
        ...rows.map(
            row => `<tr>${row.map(value => `<td>${htmlEscape(value)}</td>`).join('')}</tr>`
        ),
        '</tbody>',
        '</table>',
    ].join('')
}

export function htmlCodeList(values: string[], fallback = 'n/a'): string {
    return values.length > 0
        ? values.map(value => `<code>${htmlEscape(value)}</code>`).join(', ')
        : htmlEscape(fallback)
}

export function writeFile(output: string, content: string): void {
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, content.endsWith('\n') ? content : `${content}\n`, 'utf8')
}

export function renderTemplate(templatePath: string, data: Record<string, unknown>): string {
    const template = fs.readFileSync(templatePath, 'utf8')
    return ejs.render(template, data, {
        filename: templatePath,
    })
}

export const rstHelpers = {
    code,
    codeList,
    heading,
    listTable,
    roleMessageCount,
    rstDocLink,
}

export const markdownHelpers = {
    markdownCodeList,
    markdownTable,
    roleMessageCount,
}

export const htmlHelpers = {
    htmlCodeList,
    htmlEscape,
    htmlTable,
    roleMessageCount,
}
