const pad = (value: number) => String(value).padStart(2, "0");

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const DEFAULT_DATE_FORMAT = "dd MMM yyyy";

export const toDateTimeInputValue = (value?: string | Date) => {
  if (!value) return "";

  const date = new Date(value);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const endOfTodayInputValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59`;
};

export const formattedDate = (value?: string | Date, pattern: string = DEFAULT_DATE_FORMAT) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();

  switch (pattern) {
    case "dd/MM/yyyy":
      return `${day}/${month}/${year}`;
    case "MM/dd/yyyy":
      return `${month}/${day}/${year}`;
    case "yyyy-MM-dd":
      return `${year}-${month}-${day}`;
    default:
      return `${day} ${MONTHS_SHORT[date.getMonth()]} ${year}`;
  }
};

export const formattedDateTime = (value?: string | Date, pattern: string = DEFAULT_DATE_FORMAT) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${formattedDate(date, pattern)} • ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
