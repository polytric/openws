import type { HostRoleLikeCtor, RoleLikeCtor } from './types'

export function flattenRoles(roles: any[]): {
    [roleName: string]: RoleLikeCtor | HostRoleLikeCtor
} {
    const allRoles: { [roleName: string]: RoleLikeCtor | HostRoleLikeCtor } = {}
    for (const roleCtor of roles) {
        const roleName = roleCtor.CONFIG.name
        allRoles[roleName] = roleCtor

        if (isHostRoleCtor(roleCtor)) {
            for (const [_, handlerConfig] of Object.entries(
                (roleCtor as HostRoleLikeCtor).CONFIG.handlers
            )) {
                if (handlerConfig.from) {
                    for (const from of handlerConfig.from ?? []) {
                        const fromRoleName = from.CONFIG.name
                        allRoles[fromRoleName] = from
                    }
                }
            }
        }
    }
    return allRoles
}

export function isHostRoleCtor(ctor: any): ctor is HostRoleLikeCtor {
    return !!ctor?.CONFIG && typeof ctor.CONFIG === 'object' && !!ctor.CONFIG.handlers
}
