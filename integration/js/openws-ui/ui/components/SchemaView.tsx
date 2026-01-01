import { JsonSchemaViewer } from '@stoplight/json-schema-viewer'
import mosaicStyles from '@stoplight/mosaic/styles.css?inline'
import mosaicTheme from '@stoplight/mosaic/themes/default.css?inline'

import { ShadowStyles } from './ShadowStyles'

const STOPLIGHT_CSS = `${mosaicTheme}\n${mosaicStyles}`

export function SchemaView({ schema }: { schema: any }) {
    return (
        <ShadowStyles cssText={STOPLIGHT_CSS}>
            <JsonSchemaViewer schema={schema} />
        </ShadowStyles>
    )
}
