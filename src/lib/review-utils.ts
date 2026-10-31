export function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function ratingTone(value: number) {
  if (value <= 3) {
    return {
      bg: "bg-[#FDECEC]",
      text: "text-[#B42318]",
      border: "border-[#F6C5C1]",
    };
  }

  if (value <= 6) {
    return {
      bg: "bg-[#FFF8E6]",
      text: "text-[#B45309]",
      border: "border-[#F3DEAA]",
    };
  }

  return {
    bg: "bg-[#ECFDF3]",
    text: "text-[#027A48]",
    border: "border-[#A6E3BD]",
  };
}
