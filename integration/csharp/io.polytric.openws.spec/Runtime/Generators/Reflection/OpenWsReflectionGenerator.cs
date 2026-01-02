using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

using Polytric.OpenWs.Spec.Attributes;

namespace Polytric.OpenWs.Spec.Generation
{
    public sealed class OpenWsSpecGeneratorOptions
    {
        public Type NetworkBaseType;
        public Type RoleBaseType;

        // top-level spec fields (passed in)
        public string Openws;
        public string Name;
        public string Version { get; set; }
        public string Description { get; set; }

        public string NamespacePrefix { get; set; }
    }

    public static class UnityOpenWsSpecGenerator
    {
        // Fixed behaviors:
        // - public instance methods only
        // - always require roles on [Network]
        // - always throw on duplicate keys
        public static Serialization.Spec Generate(Assembly asm, OpenWsSpecGeneratorOptions opts)
        {
            if (opts == null) throw new ArgumentNullException(nameof(opts));
            if (opts.NetworkBaseType == null) throw new ArgumentNullException("opts.NetworkBaseType");
            if (opts.RoleBaseType == null) throw new ArgumentNullException("opts.RoleBaseType");
            if (opts.Openws == null) throw new ArgumentNullException("opts.Openws");
            if (opts.Name == null) throw new ArgumentNullException("opts.Name");

            var spec = new Serialization.Spec
            {
                Openws = opts.Openws,
                Name = opts.Name,
                Version = opts.Version,
                Description = opts.Description
            };

            var allTypes = asm.GetTypes()
                .Where(t => t.IsClass && !t.IsAbstract)
                .Where(t => string.IsNullOrEmpty(opts.NamespacePrefix) || (t.Namespace != null && t.Namespace.StartsWith(opts.NamespacePrefix)))
                .ToArray();

            var networkTypes = DiscoverNetworks(allTypes, opts);

            foreach (var networkType in networkTypes)
            {
                var na = (NetworkAttribute)networkType.GetCustomAttributes(typeof(NetworkAttribute), false).FirstOrDefault();

                var networkKey = FirstNonEmpty(
                    na?.Name,
                    GetNameOverride(networkType),
                    ToCamelCase(networkType.Name)
                );

                if (spec.Networks.ContainsKey(networkKey))
                    throw new InvalidOperationException("Duplicate network key '" + networkKey + "'.");

                var network = new Serialization.Network
                {
                    Name = networkKey,
                    Description = FirstNonEmpty(
                        na?.Description,
                        GetDescriptionOverride(networkType)
                    ),
                    Version = FirstNonEmpty(
                        na?.Version,
                        GetVersionOverride(networkType)
                    )
                };

                // Resolve roles
                Type[] roleTypes;
                if (na != null)
                {
                    if (na.Roles == null || na.Roles.Length == 0)
                        throw new InvalidOperationException("[Network] '" + networkType.FullName + "' must specify Roles.");
                    roleTypes = na.Roles;
                }
                else
                {
                    roleTypes = GetStaticRoles(networkType);
                    if (roleTypes.Length == 0)
                        throw new InvalidOperationException("Network '" + networkType.FullName + "' must define public static Type[] Roles.");
                }

                // Build roles
                foreach (var roleType in roleTypes)
                {
                    EnsureRoleValid(roleType, opts);

                    var ra = (RoleAttribute)roleType.GetCustomAttributes(typeof(RoleAttribute), false).FirstOrDefault();

                    var roleKey = FirstNonEmpty(
                        ra?.Name,
                        GetNameOverride(roleType),
                        ToCamelCase(roleType.Name)
                    );

                    if (network.Roles.ContainsKey(roleKey))
                        throw new InvalidOperationException("Duplicate role key '" + roleKey + "' in network '" + networkKey + "'.");

                    var role = new Serialization.Role
                    {
                        Description = FirstNonEmpty(
                            ra?.Description,
                            GetDescriptionOverride(roleType)
                        )
                    };

                    // Endpoints
                    var epAttrs = roleType.GetCustomAttributes(typeof(EndpointAttribute), false);
                    foreach (var t in epAttrs)
                    {
                        var ep = (EndpointAttribute)t;
                        var endpoint = new Serialization.Endpoint
                        {
                            Scheme = ep.Scheme ?? "ws",
                            Host = ep.Host,
                            Port = ep.Port,
                            Path = ep.Path
                        };
                        role.Endpoints.Add(endpoint);
                    }

                    // Messages + handlers -> Role.Messages
                    foreach (var kv in BuildMessages(roleType, opts))
                    {
                        if (role.Messages.ContainsKey(kv.Key))
                            throw new InvalidOperationException("Duplicate message key '" + kv.Key + "' in role '" + roleKey + "'.");
                        role.Messages[kv.Key] = kv.Value;
                    }

                    network.Roles[roleKey] = role;
                }

                spec.Networks[networkKey] = network;
            }

            return spec;
        }

        private static Type[] DiscoverNetworks(Type[] allTypes, OpenWsSpecGeneratorOptions opts)
        {
            var list = new List<Type>();
            foreach (var t in allTypes)
            {
                var hasAttr = t.GetCustomAttributes(typeof(NetworkAttribute), false).Length > 0;
                if (hasAttr) { list.Add(t); continue; }

                if (opts.NetworkBaseType.IsAssignableFrom(t) && t != opts.NetworkBaseType)
                    list.Add(t);
            }
            return list.ToArray();
        }

        private static void EnsureRoleValid(Type roleType, OpenWsSpecGeneratorOptions opts)
        {
            var hasRoleAttr = roleType.GetCustomAttributes(typeof(RoleAttribute), false).Length > 0;
            var isRoleBase = opts.RoleBaseType.IsAssignableFrom(roleType) && roleType != opts.RoleBaseType;

            if (!hasRoleAttr && !isRoleBase)
                throw new InvalidOperationException("Role '" + roleType.FullName + "' must have [Role] or inherit RoleBaseType.");
        }

        private static Type[] GetStaticRoles(Type networkType)
        {
            const BindingFlags flags = BindingFlags.Public | BindingFlags.Static;

            var p = networkType.GetProperty("Roles", flags);
            if (p != null && p.PropertyType == typeof(Type[]) && p.GetGetMethod() != null)
                return (Type[])p.GetValue(null) ?? Array.Empty<Type>();

            var f = networkType.GetField("Roles", flags);
            if (f != null && f.FieldType == typeof(Type[]))
                return (Type[])f.GetValue(null) ?? Array.Empty<Type>();

            return Array.Empty<Type>();
        }

        // Only public instance methods
        private static IEnumerable<KeyValuePair<string, Serialization.Message>> BuildMessages(Type roleType, OpenWsSpecGeneratorOptions opts)
        {
            const BindingFlags flags = BindingFlags.Instance | BindingFlags.Public;
            var methods = roleType.GetMethods(flags);

            foreach (var m in methods)
            {
                if (m.IsSpecialName) continue;

                var msgAttr = (MessageAttribute)m.GetCustomAttributes(typeof(MessageAttribute), false).FirstOrDefault();
                var handlerAttr = (HandlerAttribute)m.GetCustomAttributes(typeof(HandlerAttribute), false).FirstOrDefault();

                if (msgAttr == null && handlerAttr == null) continue;
                if (msgAttr != null && handlerAttr != null)
                    throw new InvalidOperationException("Method cannot have both [Message] and [Handler]: " + roleType.FullName + "." + m.Name);

                bool isHandler = handlerAttr != null;
                ValidateSignature(roleType, m, opts, isHandler);

                var key = FirstNonEmpty(
                    isHandler ? handlerAttr.Name : msgAttr.Name,
                    GetNameOverride(m),
                    DeriveMethodMessageName(m.Name)
                );

                var desc = FirstNonEmpty(
                    isHandler ? handlerAttr.Description : msgAttr.Description,
                    GetDescriptionOverride(m)
                );

                var payloadType = m.GetParameters()[0].ParameterType;

                var msg = new Serialization.Message
                {
                    Description = desc,
                    Payload = payloadType.FullName
                };

                // From list
                var from = new List<string>();

                var inlineFrom = isHandler ? handlerAttr.From : msgAttr.From;
                if (inlineFrom != null && inlineFrom.Length > 0)
                    from.AddRange(inlineFrom);

                // Infer from handler api param if missing
                if (isHandler && from.Count == 0)
                {
                    var apiType = m.GetParameters()[1].ParameterType;
                    from.Add(ResolveRoleName(apiType));
                }

                msg.From = from;

                yield return new KeyValuePair<string, Serialization.Message>(key, msg);
            }
        }

        private static void ValidateSignature(Type roleType, MethodInfo m, OpenWsSpecGeneratorOptions opts, bool isHandler)
        {
            var ps = m.GetParameters();

            if (!isHandler)
            {
                if (ps.Length != 1)
                    throw new InvalidOperationException("[Message] must be Method(payload): " + roleType.FullName + "." + m.Name);
                return;
            }

            if (ps.Length != 2)
                throw new InvalidOperationException("[Handler] must be Method(payload, apiRole): " + roleType.FullName + "." + m.Name);

            var apiType = ps[1].ParameterType;
            var hasRoleAttr = apiType.GetCustomAttributes(typeof(RoleAttribute), false).Length > 0;
            var isRoleBase = opts.RoleBaseType.IsAssignableFrom(apiType) && apiType != opts.RoleBaseType;
            if (!hasRoleAttr && !isRoleBase)
                throw new InvalidOperationException("[Handler] second param must be a role type: " + roleType.FullName + "." + m.Name);
        }

        private static string ResolveRoleName(Type roleType)
        {
            var ra = (RoleAttribute)roleType.GetCustomAttributes(typeof(RoleAttribute), false).FirstOrDefault();
            return FirstNonEmpty(
                ra?.Name,
                GetNameOverride(roleType),
                ToCamelCase(roleType.Name)
            );
        }

        private static string GetNameOverride(MemberInfo mi)
        {
            var a = (NameAttribute)mi.GetCustomAttributes(typeof(NameAttribute), false).FirstOrDefault();
            return a?.Value;
        }

        private static string GetDescriptionOverride(MemberInfo mi)
        {
            var a = (DescriptionAttribute)mi.GetCustomAttributes(typeof(DescriptionAttribute), false).FirstOrDefault();
            return a?.Value;
        }

        private static string GetVersionOverride(MemberInfo mi)
        {
            var a = (VersionAttribute)mi.GetCustomAttributes(typeof(VersionAttribute), false).FirstOrDefault();
            return a?.Value;
        }

        private static string DeriveMethodMessageName(string methodName)
        {
            var n = methodName;
            if (n.EndsWith("Async")) n = n.Substring(0, n.Length - 5);
            return ToCamelCase(n);
        }

        private static string ToCamelCase(string s)
        {
            if (string.IsNullOrEmpty(s)) return s;
            if (s.Length == 1) return char.ToLowerInvariant(s[0]).ToString();
            return char.ToLowerInvariant(s[0]) + s.Substring(1);
        }

        private static string FirstNonEmpty(params string[] xs)
        {
            foreach (var x in xs)
            {
                if (!string.IsNullOrEmpty(x)) return x;
            }
            return null;
        }
    }
}
