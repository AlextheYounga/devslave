type ValidationResult = {
    isValid: boolean;
    error?: string;
};

/**
 * Validates that all required fields are present and truthy in the given data object.
 *
 * @param data - The object to validate
 * @param requiredFields - Array of field names that must be present and truthy
 * @returns ValidationResult with isValid boolean and optional error message
 */
export function validateRequiredFields(
    data: Record<string, any>,
    requiredFields: string[],
): ValidationResult {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
        if (!data[field]) {
            missingFields.push(field);
        }
    }

    if (missingFields.length > 0) {
        const fieldList = missingFields.join(", ");
        const pluralSuffix = missingFields.length === 1 ? " is" : " are";
        return {
            isValid: false,
            error: `${fieldList}${pluralSuffix} required`,
        };
    }

    return { isValid: true };
}
