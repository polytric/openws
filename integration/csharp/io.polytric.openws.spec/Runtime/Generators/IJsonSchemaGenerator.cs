using System;
using System.Collections.Generic;

namespace Polytric.OpenWs.Spec.Generation
{
    public sealed class JsonSchemaResult
    {
        public Dictionary<string, object> Root;
        public Dictionary<string, Dictionary<string, object>> Definitions;

        public JsonSchemaResult(Dictionary<string, object> root, Dictionary<string, Dictionary<string, object>> definitions)
        {
            Root = root;
            Definitions = definitions;
        }
    }

    public interface IJsonSchemaGenerator
    {
        JsonSchemaResult Generate(Type type);
    }
}
