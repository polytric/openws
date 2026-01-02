using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using Polytric.OpenWs.Spec.Generation;
using Polytric.OpenWs.Spec.Serialization.Serializer;

namespace Polytric.OpenWs.Unity.Editor
{
    public class OpenWsSpecGeneratorWindow : EditorWindow
    {
        // Base types (configurable via MonoScript references)
        private MonoScript _networkBaseTypeScript;
        private MonoScript _roleBaseTypeScript;

        // Spec options
        private string _openws = "0.0.2";
        private string _name = "myspec";
        private string _version = "";
        private string _description = "";
        private string _namespacePrefix = "";

        // Output
        private string _outputPath = "Assets/openws-spec.json";
        private string _lastResult = "";
        private Vector2 _scrollPos;

        [MenuItem("Window/OpenWS/Spec Generator")]
        public static void ShowWindow()
        {
            var window = GetWindow<OpenWsSpecGeneratorWindow>("OpenWS Spec Generator");
            window.minSize = new Vector2(400, 500);
        }

        private void OnGUI()
        {
            EditorGUILayout.LabelField("OpenWS Spec Generator", EditorStyles.boldLabel);
            EditorGUILayout.Space();

            // Base Types Section
            EditorGUILayout.LabelField("Base Types", EditorStyles.boldLabel);
            _networkBaseTypeScript = (MonoScript)EditorGUILayout.ObjectField(
                "Network Base Type",
                _networkBaseTypeScript,
                typeof(MonoScript),
                false
            );
            _roleBaseTypeScript = (MonoScript)EditorGUILayout.ObjectField(
                "Role Base Type",
                _roleBaseTypeScript,
                typeof(MonoScript),
                false
            );

            EditorGUILayout.Space();

            // Spec Options Section
            EditorGUILayout.LabelField("Spec Options", EditorStyles.boldLabel);
            _openws = EditorGUILayout.TextField("OpenWS Version", _openws);
            _name = EditorGUILayout.TextField("Name", _name);
            _version = EditorGUILayout.TextField("Version", _version);
            _description = EditorGUILayout.TextField("Description", _description);
            _namespacePrefix = EditorGUILayout.TextField("Namespace Prefix", _namespacePrefix);

            EditorGUILayout.Space();

            // Output Section
            EditorGUILayout.LabelField("Output", EditorStyles.boldLabel);
            EditorGUILayout.BeginHorizontal();
            _outputPath = EditorGUILayout.TextField("Output Path", _outputPath);
            if (GUILayout.Button("...", GUILayout.Width(30)))
            {
                var path = EditorUtility.SaveFilePanel("Save Spec JSON", "Assets", "openws-spec", "json");
                if (!string.IsNullOrEmpty(path))
                {
                    if (path.StartsWith(Application.dataPath))
                        path = "Assets" + path.Substring(Application.dataPath.Length);
                    _outputPath = path;
                }
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space();

            // Generate Button
            GUI.enabled = _networkBaseTypeScript != null && _roleBaseTypeScript != null;
            if (GUILayout.Button("Generate Spec", GUILayout.Height(30)))
            {
                Generate();
            }
            GUI.enabled = true;

            if (_networkBaseTypeScript == null || _roleBaseTypeScript == null)
            {
                EditorGUILayout.HelpBox("Please assign both Network Base Type and Role Base Type.", MessageType.Warning);
            }

            EditorGUILayout.Space();

            // Result Preview
            if (!string.IsNullOrEmpty(_lastResult))
            {
                EditorGUILayout.LabelField("Result Preview", EditorStyles.boldLabel);
                _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos, GUILayout.Height(200));
                EditorGUILayout.TextArea(_lastResult, GUILayout.ExpandHeight(true));
                EditorGUILayout.EndScrollView();
            }
        }

        private void Generate()
        {
            try
            {
                var networkBaseType = _networkBaseTypeScript.GetClass();
                var roleBaseType = _roleBaseTypeScript.GetClass();

                if (networkBaseType == null)
                {
                    EditorUtility.DisplayDialog("Error", "Could not resolve Network Base Type class.", "OK");
                    return;
                }
                if (roleBaseType == null)
                {
                    EditorUtility.DisplayDialog("Error", "Could not resolve Role Base Type class.", "OK");
                    return;
                }

                var opts = new OpenWsSpecGeneratorOptions
                {
                    NetworkBaseType = networkBaseType,
                    RoleBaseType = roleBaseType,
                    Openws = _openws,
                    Name = _name,
                    Version = string.IsNullOrEmpty(_version) ? null : _version,
                    Description = string.IsNullOrEmpty(_description) ? null : _description,
                    NamespacePrefix = string.IsNullOrEmpty(_namespacePrefix) ? null : _namespacePrefix,
                };

                var assembly = networkBaseType.Assembly;
                var spec = UnityOpenWsSpecGenerator.Generate(assembly, opts);

                var serializer = new NewtonSoftSerializer();
                var json = serializer.Serialize(spec);

                _lastResult = json;

                var fullPath = _outputPath;
                if (!Path.IsPathRooted(fullPath))
                    fullPath = Path.Combine(Application.dataPath, "..", fullPath);

                File.WriteAllText(fullPath, json);
                AssetDatabase.Refresh();

                EditorUtility.DisplayDialog("Success", "Spec generated and saved to:\n" + _outputPath, "OK");
            }
            catch (Exception ex)
            {
                _lastResult = "Error: " + ex.Message + "\n\n" + ex.StackTrace;
                EditorUtility.DisplayDialog("Error", ex.Message, "OK");
                Debug.LogException(ex);
            }
        }
    }
}

