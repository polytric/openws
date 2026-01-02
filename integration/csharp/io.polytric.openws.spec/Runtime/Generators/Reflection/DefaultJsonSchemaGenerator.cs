using System;
using System.Collections.Generic;
using System.Reflection;
using Polytric.OpenWs.Spec.Generation;

namespace Polytric.OpenWs.Spec.Generation.Reflection
{
    public sealed class DefaultJsonSchemaGenerator : IJsonSchemaGenerator
    {
        public sealed class Options
        {
            public int MaxDepth = 32;
            public bool UseRefs = true;
            public bool IncludePublicFields = true;
            public bool IncludePublicProperties = true;
        }

        private readonly Options _opts;

        public DefaultJsonSchemaGenerator(Options opts)
        {
            _opts = opts ?? new Options();
        }

        public JsonSchemaResult Generate(Type type)
        {
            var ctx = new Ctx(_opts);
            var root = Build(type, ctx, 0);
            return new JsonSchemaResult(root, ctx.Definitions);
        }

        private sealed class Ctx
        {
            public readonly Options Opts;
            public readonly Dictionary<Type, string> TypeToKey = new Dictionary<Type, string>();
            public readonly Dictionary<string, Dictionary<string, object>> Definitions = new Dictionary<string, Dictionary<string, object>>();
            public readonly HashSet<Type> InProgress = new HashSet<Type>();

            public Ctx(Options opts) { Opts = opts; }
        }

        private Dictionary<string, object> Build(Type t, Ctx ctx, int depth)
        {
            if (depth > ctx.Opts.MaxDepth)
                return Obj("type", "object");

            var underlying = Nullable.GetUnderlyingType(t);
            if (underlying != null)
            {
                var inner = Build(underlying, ctx, depth + 1);
                inner["x-nullable"] = true; // extension
                return inner;
            }

            if (t == typeof(string)) return Obj("type", "string");
            if (t == typeof(bool)) return Obj("type", "boolean");

            if (t == typeof(byte) || t == typeof(short) || t == typeof(int) || t == typeof(long) ||
                t == typeof(sbyte) || t == typeof(ushort) || t == typeof(uint) || t == typeof(ulong))
                return Obj("type", "integer");

            if (t == typeof(float) || t == typeof(double) || t == typeof(decimal))
                return Obj("type", "number");

            if (t.IsEnum)
                return Obj("type", "string", "enum", Enum.GetNames(t));

            if (t.IsArray)
            {
                var elem = t.GetElementType();
                return Obj("type", "array", "items", Build(elem, ctx, depth + 1));
            }

            var elemType = TryGetEnumerableElementType(t);
            if (elemType != null)
                return Obj("type", "array", "items", Build(elemType, ctx, depth + 1));

            Type dictValue;
            if (TryGetDictionaryValueType(t, out dictValue))
            {
                var ap = Build(dictValue, ctx, depth + 1);
                var o = Obj("type", "object");
                o["additionalProperties"] = ap;
                return o;
            }

            var dots = TryHandleDotsSpecial(t);
            if (dots != null) return dots;

            if (ctx.Opts.UseRefs)
            {
                string key;
                if (ctx.TypeToKey.TryGetValue(t, out key))
                    return Obj("$ref", "#/definitions/" + key);

                key = MakeDefKey(t);
                ctx.TypeToKey[t] = key;

                if (ctx.InProgress.Contains(t))
                    return Obj("$ref", "#/definitions/" + key);

                ctx.InProgress.Add(t);
                var def = BuildObjectSchema(t, ctx, depth + 1);
                ctx.Definitions[key] = def;
                ctx.InProgress.Remove(t);

                return Obj("$ref", "#/definitions/" + key);
            }

            return BuildObjectSchema(t, ctx, depth + 1);
        }

        private Dictionary<string, object> BuildObjectSchema(Type t, Ctx ctx, int depth)
        {
            var props = new Dictionary<string, object>();
            var required = new List<string>();

            const BindingFlags flags = BindingFlags.Instance | BindingFlags.Public;

            if (ctx.Opts.IncludePublicFields)
            {
                foreach (var f in t.GetFields(flags))
                {
                    if (f.IsStatic) continue;
                    var name = ToCamelCase(f.Name);
                    props[name] = Build(f.FieldType, ctx, depth + 1);
                    required.Add(name);
                }
            }

            if (ctx.Opts.IncludePublicProperties)
            {
                foreach (var p in t.GetProperties(flags))
                {
                    if (p.GetIndexParameters().Length != 0) continue;
                    if (!p.CanRead) continue;
                    var gm = p.GetGetMethod();
                    if (gm == null || gm.IsStatic) continue;

                    var name = ToCamelCase(p.Name);
                    props[name] = Build(p.PropertyType, ctx, depth + 1);
                    required.Add(name);
                }
            }

            var o = Obj("type", "object");
            o["properties"] = props;
            o["required"] = required.ToArray();
            return o;
        }

        private static Type TryGetEnumerableElementType(Type t)
        {
            if (t.IsGenericType && t.GetGenericTypeDefinition() == typeof(List<>))
                return t.GetGenericArguments()[0];

            foreach (var it in t.GetInterfaces())
            {
                if (it.IsGenericType && it.GetGenericTypeDefinition() == typeof(IEnumerable<>))
                    return it.GetGenericArguments()[0];
            }
            return null;
        }

        private static bool TryGetDictionaryValueType(Type t, out Type value)
        {
            value = null;

            if (t.IsGenericType && t.GetGenericTypeDefinition() == typeof(Dictionary<,>))
            {
                value = t.GetGenericArguments()[1];
                return true;
            }

            foreach (var it in t.GetInterfaces())
            {
                if (it.IsGenericType && it.GetGenericTypeDefinition() == typeof(IDictionary<,>))
                {
                    value = it.GetGenericArguments()[1];
                    return true;
                }
            }

            return false;
        }

        private static Dictionary<string, object> TryHandleDotsSpecial(Type t)
        {
            var full = t.FullName ?? "";
            if (full.StartsWith("Unity.Collections.FixedString", StringComparison.Ordinal))
                return Obj("type", "string");
            if (full.StartsWith("Unity.Entities.Entity", StringComparison.Ordinal))
                return Obj("type", "string", "x-unity-entity", true);
            return null;
        }

        private static string MakeDefKey(Type t)
        {
            return (t.FullName ?? t.Name).Replace('+', '.');
        }

        private static Dictionary<string, object> Obj(params object[] kv)
        {
            var d = new Dictionary<string, object>();
            for (int i = 0; i < kv.Length; i += 2)
                d[(string)kv[i]] = kv[i + 1];
            return d;
        }

        private static string ToCamelCase(string s)
        {
            if (string.IsNullOrEmpty(s)) return s;
            if (s.Length == 1) return char.ToLowerInvariant(s[0]).ToString();
            return char.ToLowerInvariant(s[0]) + s.Substring(1);
        }
    }
}
