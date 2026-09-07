export interface FilterCondition {
  id: string;
  value: string;
  operator:
    | "contains"
    | "notContains"
    | "equals"
    | "notEquals"
    | "startsWith"
    | "endsWith"
    | "isBlank"
    | "isNotBlank";
}

export type LogicOperator = "AND" | "OR";

export interface ComplexFilterValue {
  conditions: FilterCondition[];
  logicOperator: LogicOperator;
}

export const complexFilter = (
  row: any,
  columnId: string,
  filterValue: ComplexFilterValue
) => {
  const { conditions, logicOperator } = filterValue;

  if (!conditions || conditions.length === 0) return true;

  const cellValue = row.getValue(columnId)?.toString().toLowerCase() ?? "";

  const evaluate = (condition: FilterCondition) => {
    const filterVal = condition.value.toLowerCase();
    switch (condition.operator) {
      case "contains":
        return cellValue.includes(filterVal);
      case "notContains":
        return !cellValue.includes(filterVal);
      case "equals":
        return +cellValue === +filterVal;
      case "notEquals":
        return +cellValue !== +filterVal;
      case "startsWith":
        return cellValue.startsWith(filterVal);
      case "endsWith":
        return cellValue.endsWith(filterVal);
      case "isBlank":
        return cellValue === "";
      case "isNotBlank":
        return cellValue !== "";
      default:
        return true;
    }
  };

  const results = conditions.map(evaluate);
  return logicOperator === "AND"
    ? results.every(Boolean)
    : results.some(Boolean);
};
