"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { batchDirectCreateAction, batchCreateSubmissions, CollectionType } from "@/lib/actions";
import { Select, Button, Card, Heading, Text, Flex, Box, Container, Spinner, Callout, TextField } from "@radix-ui/themes";
import { AlertCircle, Check, Plus, X } from "lucide-react";
import { AudioUploadInput } from "@/components/AudioUploadInput";
import { AudioPreview } from "@/components/AudioPreview";

export interface FormField {
  name: string;
  label: string;
  type: "text" | "select" | "audio";
  required?: boolean;
  unique?: boolean;
  options?: string[];
  placeholder?: string;
}

type FormDataRecord = Record<string, string>;

interface BatchCreateFormProps {
  collection: CollectionType;
  title: string;
  description: string | ((role: string) => string);
  fields: FormField[];
  defaultValues: FormDataRecord;
  successRedirect: string;
  searchParamMapping?: Record<string, string>;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function BatchCreateForm({
  collection,
  title,
  description,
  fields,
  defaultValues,
  successRedirect,
  searchParamMapping,
}: BatchCreateFormProps) {
  const { user, role } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const getInitialValues = (): FormDataRecord => {
    const values = { ...defaultValues };
    if (searchParamMapping) {
      for (const [paramName, fieldName] of Object.entries(searchParamMapping)) {
        const paramValue = searchParams.get(paramName);
        if (paramValue) {
          values[fieldName] = paramValue;
          break;
        }
      }
    }
    return values;
  };

  const [forms, setForms] = useState<FormDataRecord[]>([
    { ...getInitialValues(), _formId: generateId() },
  ]);
  const [formErrors, setFormErrors] = useState<Record<string, Record<string, string>>>({});
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const addForm = () => {
    setForms([...forms, { ...defaultValues, _formId: generateId() }]);
  };

  const removeForm = (index: number) => {
    if (forms.length <= 1) return;
    const newForms = [...forms];
    newForms.splice(index, 1);
    setForms(newForms);
  };

  const updateForm = (index: number, field: string, value: string) => {
    const newForms = [...forms];
    newForms[index] = { ...newForms[index], [field]: value };
    setForms(newForms);

    const formId = forms[index]._formId;
    if (serverFieldErrors[formId]?.[field]) {
      const newServerErrors = { ...serverFieldErrors };
      const fieldErrors = { ...newServerErrors[formId] };
      delete fieldErrors[field];
      if (Object.keys(fieldErrors).length === 0) {
        delete newServerErrors[formId];
      } else {
        newServerErrors[formId] = fieldErrors;
      }
      setServerFieldErrors(newServerErrors);
    }
  };

  const handleAudioUploadComplete = (index: number, audioUrl: string) => {
    updateForm(index, "tts_url", audioUrl);
  };

  const handleAudioUploadError = (errorMsg: string) => {
    setError(errorMsg);
  };

  const handleRemoveAudio = (index: number) => {
    updateForm(index, "tts_url", "");
  };

  const validateForm = (formData: FormDataRecord): Record<string, string> => {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (field.type === "audio") continue;
      if (field.required && (!formData[field.name] || formData[field.name].trim() === "")) {
        errors[field.name] = `${field.label} is required`;
      }
    }
    return errors;
  };

  const validateBatchDuplicates = (allForms: FormDataRecord[]): Record<string, Record<string, string>> => {
    const allErrors: Record<string, Record<string, string>> = {};
    const uniqueFields = fields.filter((f) => f.unique);

    for (const uniqueField of uniqueFields) {
      const seen = new Map<string, number>();
      for (let i = 0; i < allForms.length; i++) {
        const value = (allForms[i][uniqueField.name] || "").trim().toLowerCase();
        if (!value) continue;

        if (seen.has(value)) {
          const firstIndex = seen.get(value)!;
          const firstId = allForms[firstIndex]._formId;
          if (!allErrors[firstId]) allErrors[firstId] = {};
          allErrors[firstId][uniqueField.name] = `Duplicate in this batch`;
          const currentId = allForms[i]._formId;
          if (!allErrors[currentId]) allErrors[currentId] = {};
          allErrors[currentId][uniqueField.name] = `Duplicate in this batch`;
        } else {
          seen.set(value, i);
        }
      }
    }

    return allErrors;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setError("");
    setServerFieldErrors({});
    const allErrors: Record<string, Record<string, string>> = {};
    let hasErrors = false;

    for (let i = 0; i < forms.length; i++) {
      const errors = validateForm(forms[i]);
      if (Object.keys(errors).length > 0) {
        allErrors[forms[i]._formId] = errors;
        hasErrors = true;
      }
    }

    const batchDupErrors = validateBatchDuplicates(forms);
    for (const [formId, fieldErrors] of Object.entries(batchDupErrors)) {
      allErrors[formId] = { ...(allErrors[formId] || {}), ...fieldErrors };
      hasErrors = true;
    }

    setFormErrors(allErrors);

    if (hasErrors) {
      setError("Please fix the errors in the forms below");
      return;
    }

    setLoading(true);

    const itemsToSubmit = forms.map((form) => {
      const { _formId, ...rest } = form;
      return rest;
    });
    const token = await user.getIdToken();
    const isAdmin = role === "admin";

    const result = isAdmin
      ? await batchDirectCreateAction(collection, itemsToSubmit, token)
      : await batchCreateSubmissions(collection, itemsToSubmit, token);

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setCreatedCount(result.count);
      setTimeout(() => {
        router.push(successRedirect);
      }, 2000);
    } else {
      if (result.duplicateField && result.duplicateValue) {
        const dupField = fields.find((f) => f.name === result.duplicateField);
        const dupValue = result.duplicateValue.toLowerCase();
        const serverErrors: Record<string, Record<string, string>> = {};
        for (let i = 0; i < forms.length; i++) {
          if ((forms[i][result.duplicateField!] || "").trim().toLowerCase() === dupValue) {
            serverErrors[forms[i]._formId] = {
              [result.duplicateField!]: `This ${dupField?.label.toLowerCase() || result.duplicateField} already exists`,
            };
          }
        }
        setServerFieldErrors(serverErrors);
        setError(`"${result.duplicateValue}" already exists in the database`);
        return;
      }
      setError(result.error || "An error occurred");
    }
  }

  if (success) {
    const isAdmin = role === "admin";
    return (
      <Flex minHeight="100vh" align="center" justify="center">
        <Flex direction="column" align="center" gap="3">
          <Check className="w-12 h-12" style={{ color: "var(--green-9)" }} />
          <Heading size="5" highContrast>
            {isAdmin
              ? `${createdCount} ${collection} entries created!`
              : `${createdCount} submissions sent for review!`}
          </Heading>
          <Text color="gray">
            Redirecting...
          </Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Box minHeight="100vh">
      <Container size="2" px="4" py="6">
        <Heading size="7" mb="1" highContrast>{title}</Heading>
        <Text color="gray" size="3" as="p" mb="6">
          {typeof description === "function" ? description(role ?? "") : description}
        </Text>

        {error && (
          <Callout.Root color="red" size="2" mb="4">
            <Callout.Icon><AlertCircle className="w-4 h-4" /></Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            {forms.map((formData, index) => {
              const errors = { ...(formErrors[formData._formId] || {}), ...(serverFieldErrors[formData._formId] || {}) };
              const hasErrors = Object.keys(errors).length > 0;
              const hasAudio = formData.tts_url && formData.tts_url !== "";

              return (
                <Flex key={formData._formId} direction="column" gap="2">
                  {hasErrors && (
                    <Callout.Root color="red" size="1">
                      <Callout.Icon><AlertCircle className="w-3 h-3" /></Callout.Icon>
                      <Callout.Text>
                        Entry {index + 1}: {Object.values(errors).join(", ")}
                      </Callout.Text>
                    </Callout.Root>
                  )}
                <Card size="3">
                  <Flex direction="column" gap="4">
                    <Flex justify="between" align="center">
                      <Heading size="4">Entry {index + 1}</Heading>
                      {forms.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          color="red"
                          size="2"
                          onClick={() => removeForm(index)}
                        >
                          <X className="w-4 h-4" />
                          Remove
                        </Button>
                      )}
                    </Flex>

                    {fields.map((field) => {
                      if (field.type === "audio") {
                        return (
                          <Box key={field.name}>
                            <Text size="2" weight="medium" mb="2">{field.label}</Text>
                            <Flex direction="column" gap="3">
                              {hasAudio ? (
                                <AudioPreview
                                  audioUrl={formData.tts_url}
                                  label="Uploaded Audio"
                                  onRemove={() => handleRemoveAudio(index)}
                                />
                              ) : (
                                <AudioUploadInput
                                  collection={collection}
                                  itemId="new"
                                  onUploadComplete={(url) => handleAudioUploadComplete(index, url)}
                                  onUploadError={handleAudioUploadError}
                                />
                              )}
                              <Text size="1" color="gray">
                                Upload an audio file (MP3, WAV, OGG, M4A, FLAC) for pronunciation
                              </Text>
                            </Flex>
                          </Box>
                        );
                      }

                      if (field.type === "select") {
                        return (
                          <Box key={field.name}>
                            <Text as="label" size="2" weight="medium" mb="1">
                              {field.label} {field.required ? "*" : ""}
                            </Text>
                            <Select.Root
                              value={formData[field.name]}
                              onValueChange={(value) => updateForm(index, field.name, value)}
                            >
                              <Select.Trigger style={{ width: "100%" }} />
                              <Select.Content>
                                {field.options?.map((option) => (
                                  <Select.Item key={option} value={option}>{option}</Select.Item>
                                ))}
                              </Select.Content>
                            </Select.Root>
                            {errors[field.name] && (
                              <Text size="1" color="red" mt="1">{errors[field.name]}</Text>
                            )}
                          </Box>
                        );
                      }

                      return (
                        <Box key={field.name}>
                          <Text as="label" htmlFor={`${formData._formId}-${field.name}`} size="2" weight="medium" mb="1">
                            {field.label} {field.required ? "*" : ""}
                          </Text>
                          <TextField.Root
                            id={`${formData._formId}-${field.name}`}
                            required={field.required}
                            value={formData[field.name] || ""}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateForm(index, field.name, e.target.value)}
                            size="3"
                            placeholder={field.placeholder}
                          />
                          {errors[field.name] && (
                            <Text size="1" color="red" mt="1">{errors[field.name]}</Text>
                          )}
                        </Box>
                      );
                    })}
                  </Flex>
                </Card>
                </Flex>
              );
            })}

            <Flex gap="3" wrap="wrap">
              <Button
                type="button"
                variant="soft"
                size="3"
                onClick={addForm}
              >
                <Plus className="w-4 h-4" />
                Add Another Entry
              </Button>
            </Flex>

            <Flex gap="3">
              <Button type="submit" disabled={loading} size="3" style={{ flex: 1 }}>
                {loading ? (
                  <Spinner size="3" />
                ) : (
                  `Submit All (${forms.length} ${forms.length === 1 ? "entry" : "entries"})`
                )}
              </Button>
              <Button
                type="button"
                variant="soft"
                color="gray"
                size="3"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </Flex>
          </Flex>
        </form>
      </Container>
    </Box>
  );
}
