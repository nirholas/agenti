using System.Text.Json;
using System.Text.Json.Serialization;

namespace x402.Core.JsonConverters
{
    public class LowercaseEnumConverter<TEnum> : JsonConverter<TEnum> where TEnum : struct, Enum
    {
        public override TEnum Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            string? value = reader.GetString();
            if (value is null)
                throw new JsonException("Expected string for enum value.");

            // Case-insensitive parse
            if (Enum.TryParse<TEnum>(value, ignoreCase: true, out var result))
            {
                return result;
            }

            throw new JsonException($"Unable to convert \"{value}\" to {typeof(TEnum)}.");
        }

        public override void Write(Utf8JsonWriter writer, TEnum value, JsonSerializerOptions options)
        {
            writer.WriteStringValue(value.ToString().ToLowerInvariant());
        }
    }
}
