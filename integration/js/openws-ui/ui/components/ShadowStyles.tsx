import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function ShadowStyles(props: { cssText: string; children: React.ReactNode }) {
    const hostRef = useRef<HTMLDivElement>(null)
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null)

    useLayoutEffect(() => {
        const host = hostRef.current
        if (!host) return

        const shadow = host.attachShadow({ mode: 'open' })

        const style = document.createElement('style')
        style.textContent = props.cssText
        shadow.appendChild(style)

        const mount = document.createElement('div')
        shadow.appendChild(mount)
        setMountNode(mount)

        return () => {
            setMountNode(null)
        }
    }, [props.cssText])

    return <div ref={hostRef}>{mountNode ? createPortal(props.children, mountNode) : null}</div>
}
