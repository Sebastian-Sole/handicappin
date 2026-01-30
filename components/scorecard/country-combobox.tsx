"use client";

import * as React from "react";
import { Search, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Helper function to extract country name from label (removes emoji)
const getCountryName = (label: string): string => {
  // Remove emoji and any trailing whitespace
  // Emojis are typically at the end of the label
  return label.replace(/\s*[\u{1F1E0}-\u{1F1FF}][\u{1F1E0}-\u{1F1FF}]|\s*[\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}]+|\s*[\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}]+|\s*[\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}]+|\s*🍀/gu, '').trim();
};

const countries = [
  { value: "afghanistan", label: "Afghanistan 🇦🇫" },
  { value: "albania", label: "Albania 🇦🇱" },
  { value: "algeria", label: "Algeria 🇩🇿" },
  { value: "andorra", label: "Andorra 🇦🇩" },
  { value: "angola", label: "Angola 🇦🇴" },
  { value: "antigua-and-barbuda", label: "Antigua and Barbuda 🇦🇬" },
  { value: "argentina", label: "Argentina 🇦🇷" },
  { value: "armenia", label: "Armenia 🇦🇲" },
  { value: "australia", label: "Australia 🇦🇺" },
  { value: "austria", label: "Austria 🇦🇹" },
  { value: "azerbaijan", label: "Azerbaijan 🇦🇿" },
  { value: "bahamas", label: "Bahamas 🇧🇸" },
  { value: "bahrain", label: "Bahrain 🇧🇭" },
  { value: "bangladesh", label: "Bangladesh 🇧🇩" },
  { value: "barbados", label: "Barbados 🇧🇧" },
  { value: "belarus", label: "Belarus 🇧🇾" },
  { value: "belgium", label: "Belgium 🇧🇪" },
  { value: "belize", label: "Belize 🇧🇿" },
  { value: "benin", label: "Benin 🇧🇯" },
  { value: "bhutan", label: "Bhutan 🇧🇹" },
  { value: "bolivia", label: "Bolivia 🇧🇴" },
  { value: "bosnia-and-herzegovina", label: "Bosnia and Herzegovina 🇧🇦" },
  { value: "botswana", label: "Botswana 🇧🇼" },
  { value: "brazil", label: "Brazil 🇧🇷" },
  { value: "brunei", label: "Brunei 🇧🇳" },
  { value: "bulgaria", label: "Bulgaria 🇧🇬" },
  { value: "burkina-faso", label: "Burkina Faso 🇧🇫" },
  { value: "burundi", label: "Burundi 🇧🇮" },
  { value: "cabo-verde", label: "Cabo Verde 🇨🇻" },
  { value: "cambodia", label: "Cambodia 🇰🇭" },
  { value: "cameroon", label: "Cameroon 🇨🇲" },
  { value: "canada", label: "Canada 🇨🇦" },
  { value: "central-african-republic", label: "Central African Republic 🇨🇫" },
  { value: "chad", label: "Chad 🇹🇩" },
  { value: "chile", label: "Chile 🇨🇱" },
  { value: "china", label: "China 🇨🇳" },
  { value: "colombia", label: "Colombia 🇨🇴" },
  { value: "comoros", label: "Comoros 🇰🇲" },
  {
    value: "congo-democratic-republic",
    label: "Congo (Democratic Republic) 🇨🇩",
  },
  { value: "congo-republic", label: "Congo (Republic) 🇨🇬" },
  { value: "costa-rica", label: "Costa Rica 🇨🇷" },
  { value: "croatia", label: "Croatia 🇭🇷" },
  { value: "cuba", label: "Cuba 🇨🇺" },
  { value: "cyprus", label: "Cyprus 🇨🇾" },
  { value: "czech-republic", label: "Czech Republic 🇨🇿" },
  { value: "denmark", label: "Denmark 🇩🇰" },
  { value: "djibouti", label: "Djibouti 🇩🇯" },
  { value: "dominica", label: "Dominica 🇩🇲" },
  { value: "dominican-republic", label: "Dominican Republic 🇩🇴" },
  { value: "ecuador", label: "Ecuador 🇪🇨" },
  { value: "egypt", label: "Egypt 🇪🇬" },
  { value: "el-salvador", label: "El Salvador 🇸🇻" },
  { value: "england", label: "England 🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { value: "equatorial-guinea", label: "Equatorial Guinea 🇬🇶" },
  { value: "eritrea", label: "Eritrea 🇪🇷" },
  { value: "estonia", label: "Estonia 🇪🇪" },
  { value: "eswatini", label: "Eswatini 🇸🇿" },
  { value: "ethiopia", label: "Ethiopia 🇪🇹" },
  { value: "fiji", label: "Fiji 🇫🇯" },
  { value: "finland", label: "Finland 🇫🇮" },
  { value: "france", label: "France 🇫🇷" },
  { value: "gabon", label: "Gabon 🇬🇦" },
  { value: "gambia", label: "Gambia 🇬🇲" },
  { value: "georgia", label: "Georgia 🇬🇪" },
  { value: "germany", label: "Germany 🇩🇪" },
  { value: "ghana", label: "Ghana 🇬🇭" },
  { value: "greece", label: "Greece 🇬🇷" },
  { value: "grenada", label: "Grenada 🇬🇩" },
  { value: "guatemala", label: "Guatemala 🇬🇹" },
  { value: "guinea", label: "Guinea 🇬🇳" },
  { value: "guinea-bissau", label: "Guinea-Bissau 🇬🇼" },
  { value: "guyana", label: "Guyana 🇬🇾" },
  { value: "haiti", label: "Haiti 🇭🇹" },
  { value: "honduras", label: "Honduras 🇭🇳" },
  { value: "hungary", label: "Hungary 🇭🇺" },
  { value: "iceland", label: "Iceland 🇮🇸" },
  { value: "india", label: "India 🇮🇳" },
  { value: "indonesia", label: "Indonesia 🇮🇩" },
  { value: "iran", label: "Iran 🇮🇷" },
  { value: "iraq", label: "Iraq 🇮🇶" },
  { value: "ireland", label: "Ireland 🇮🇪" },
  { value: "israel", label: "Israel 🇮🇱" },
  { value: "italy", label: "Italy 🇮🇹" },
  { value: "jamaica", label: "Jamaica 🇯🇲" },
  { value: "japan", label: "Japan 🇯🇵" },
  { value: "jordan", label: "Jordan 🇯🇴" },
  { value: "kazakhstan", label: "Kazakhstan 🇰🇿" },
  { value: "kenya", label: "Kenya 🇰🇪" },
  { value: "kiribati", label: "Kiribati 🇰🇮" },
  { value: "north-korea", label: "Korea (North) 🇰🇵" },
  { value: "south-korea", label: "Korea (South) 🇰🇷" },
  { value: "kuwait", label: "Kuwait 🇰🇼" },
  { value: "kyrgyzstan", label: "Kyrgyzstan 🇰🇬" },
  { value: "laos", label: "Laos 🇱🇦" },
  { value: "latvia", label: "Latvia 🇱🇻" },
  { value: "lebanon", label: "Lebanon 🇱🇧" },
  { value: "lesotho", label: "Lesotho 🇱🇸" },
  { value: "liberia", label: "Liberia 🇱🇷" },
  { value: "libya", label: "Libya 🇱🇾" },
  { value: "liechtenstein", label: "Liechtenstein 🇱🇮" },
  { value: "lithuania", label: "Lithuania 🇱🇹" },
  { value: "luxembourg", label: "Luxembourg 🇱🇺" },
  { value: "madagascar", label: "Madagascar 🇲🇬" },
  { value: "malawi", label: "Malawi 🇲🇼" },
  { value: "malaysia", label: "Malaysia 🇲🇾" },
  { value: "maldives", label: "Maldives 🇲🇻" },
  { value: "mali", label: "Mali 🇲🇱" },
  { value: "malta", label: "Malta 🇲🇹" },
  { value: "marshall-islands", label: "Marshall Islands 🇲🇭" },
  { value: "mauritania", label: "Mauritania 🇲🇷" },
  { value: "mauritius", label: "Mauritius 🇲🇺" },
  { value: "mexico", label: "Mexico 🇲🇽" },
  { value: "micronesia", label: "Micronesia 🇫🇲" },
  { value: "moldova", label: "Moldova 🇲🇩" },
  { value: "monaco", label: "Monaco 🇲🇨" },
  { value: "mongolia", label: "Mongolia 🇲🇳" },
  { value: "montenegro", label: "Montenegro 🇲🇪" },
  { value: "morocco", label: "Morocco 🇲🇦" },
  { value: "mozambique", label: "Mozambique 🇲🇿" },
  { value: "myanmar", label: "Myanmar 🇲🇲" },
  { value: "namibia", label: "Namibia 🇳🇦" },
  { value: "nauru", label: "Nauru 🇳🇷" },
  { value: "nepal", label: "Nepal 🇳🇵" },
  { value: "netherlands", label: "Netherlands 🇳🇱" },
  { value: "new-zealand", label: "New Zealand 🇳🇿" },
  { value: "nicaragua", label: "Nicaragua 🇳🇮" },
  { value: "niger", label: "Niger 🇳🇪" },
  { value: "nigeria", label: "Nigeria 🇳🇬" },
  { value: "north-macedonia", label: "North Macedonia 🇲🇰" },
  { value: "northern-ireland", label: "Northern Ireland 🍀" },
  { value: "norway", label: "Norway 🇳🇴" },
  { value: "oman", label: "Oman 🇴🇲" },
  { value: "pakistan", label: "Pakistan 🇵🇰" },
  { value: "palau", label: "Palau 🇵🇼" },
  { value: "palestine", label: "Palestine 🇵🇸" },
  { value: "panama", label: "Panama 🇵🇦" },
  { value: "papua-new-guinea", label: "Papua New Guinea 🇵🇬" },
  { value: "paraguay", label: "Paraguay 🇵🇾" },
  { value: "peru", label: "Peru 🇵🇪" },
  { value: "philippines", label: "Philippines 🇵🇭" },
  { value: "poland", label: "Poland 🇵🇱" },
  { value: "portugal", label: "Portugal 🇵🇹" },
  { value: "qatar", label: "Qatar 🇶🇦" },
  { value: "romania", label: "Romania 🇷🇴" },
  { value: "russia", label: "Russia 🇷🇺" },
  { value: "rwanda", label: "Rwanda 🇷🇼" },
  { value: "saint-kitts-and-nevis", label: "Saint Kitts and Nevis 🇰🇳" },
  { value: "saint-lucia", label: "Saint Lucia 🇱🇨" },
  {
    value: "saint-vincent-and-the-grenadines",
    label: "Saint Vincent and the Grenadines 🇻🇨",
  },
  { value: "samoa", label: "Samoa 🇼🇸" },
  { value: "san-marino", label: "San Marino 🇸🇲" },
  { value: "sao-tome-and-principe", label: "Sao Tome and Principe 🇸🇹" },
  { value: "saudi-arabia", label: "Saudi Arabia 🇸🇦" },
  { value: "scotland", label: "Scotland 🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { value: "senegal", label: "Senegal 🇸🇳" },
  { value: "serbia", label: "Serbia 🇷🇸" },
  { value: "seychelles", label: "Seychelles 🇸🇨" },
  { value: "sierra-leone", label: "Sierra Leone 🇸🇱" },
  { value: "singapore", label: "Singapore 🇸🇬" },
  { value: "slovakia", label: "Slovakia 🇸🇰" },
  { value: "slovenia", label: "Slovenia 🇸🇮" },
  { value: "solomon-islands", label: "Solomon Islands 🇸🇧" },
  { value: "somalia", label: "Somalia 🇸🇴" },
  { value: "south-africa", label: "South Africa 🇿🇦" },
  { value: "south-sudan", label: "South Sudan 🇸🇸" },
  { value: "spain", label: "Spain 🇪🇸" },
  { value: "sri-lanka", label: "Sri Lanka 🇱🇰" },
  { value: "sudan", label: "Sudan 🇸🇩" },
  { value: "suriname", label: "Suriname 🇸🇷" },
  { value: "sweden", label: "Sweden 🇸🇪" },
  { value: "switzerland", label: "Switzerland 🇨🇭" },
  { value: "syria", label: "Syria 🇸🇾" },
  { value: "taiwan", label: "Taiwan 🇹🇼" },
  { value: "tajikistan", label: "Tajikistan 🇹🇯" },
  { value: "tanzania", label: "Tanzania 🇹🇿" },
  { value: "thailand", label: "Thailand 🇹🇭" },
  { value: "timor-leste", label: "Timor-Leste 🇹🇱" },
  { value: "togo", label: "Togo 🇹🇬" },
  { value: "tonga", label: "Tonga 🇹🇴" },
  { value: "trinidad-and-tobago", label: "Trinidad and Tobago 🇹🇹" },
  { value: "tunisia", label: "Tunisia 🇹🇳" },
  { value: "turkey", label: "Turkey 🇹🇷" },
  { value: "turkmenistan", label: "Turkmenistan 🇹🇲" },
  { value: "tuvalu", label: "Tuvalu 🇹🇻" },
  { value: "uganda", label: "Uganda 🇺🇬" },
  { value: "ukraine", label: "Ukraine 🇺🇦" },
  { value: "united-arab-emirates", label: "United Arab Emirates 🇦🇪" },
  { value: "united-kingdom", label: "United Kingdom 🇬🇧" },
  { value: "united-states", label: "United States 🇺🇸" },
  { value: "uruguay", label: "Uruguay 🇺🇾" },
  { value: "uzbekistan", label: "Uzbekistan 🇺🇿" },
  { value: "vanuatu", label: "Vanuatu 🇻🇺" },
  { value: "vatican-city", label: "Vatican City 🇻🇦" },
  { value: "venezuela", label: "Venezuela 🇻🇪" },
  { value: "vietnam", label: "Vietnam 🇻🇳" },
  { value: "wales", label: "Wales 🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  { value: "yemen", label: "Yemen 🇾🇪" },
  { value: "zambia", label: "Zambia 🇿🇲" },
  { value: "zimbabwe", label: "Zimbabwe 🇿🇼" },
];

interface CountryComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CountryCombobox({
  value,
  onValueChange,
  placeholder = "Search or select a country...",
  className,
  disabled = false,
}: CountryComboboxProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Match by country name (value passed in should be the actual country name like "Bosnia and Herzegovina")
  const selectedCountry = countries.find(
    (country) => getCountryName(country.label) === value
  );

  // Show all countries if no search term, or filter based on search
  const filteredCountries =
    inputValue.trim() === ""
      ? countries
      : countries.filter((country) =>
          country.label.toLowerCase().includes(inputValue.toLowerCase())
        );

  const handleCountrySelect = (country: (typeof countries)[0]) => {
    // Send the actual country name (without emoji) instead of hyphenated value
    onValueChange?.(getCountryName(country.label));
    setInputValue(country.label);
    setIsOpen(false);

    // Move focus to next focusable element to continue tab navigation
    setTimeout(() => {
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const currentIndex = Array.from(focusableElements).indexOf(
        inputRef.current!
      );
      const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
      if (nextElement) {
        nextElement.focus();
      }
    }, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredCountries.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredCountries.length
        ) {
          handleCountrySelect(filteredCountries[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      case "Tab":
        // Allow natural tab behavior to move to next element
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setIsOpen(true);
    // If a country is selected, clear the input to allow searching
    if (selectedCountry) {
      setInputValue("");
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    // Delay to allow click on dropdown items
    setTimeout(() => {
      setIsOpen(false);
      // Reset to selected country label if no selection was made
      if (selectedCountry && !value) {
        setInputValue(selectedCountry.label);
      } else if (selectedCountry) {
        setInputValue(selectedCountry.label);
      } else {
        setInputValue("");
      }
    }, 150);
  };

  // Set display value based on selection state
  const displayValue = isFocused
    ? inputValue
    : selectedCountry?.label || inputValue;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          className={cn("pl-10 pr-10", className)}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>

      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-y-auto"
          role="listbox"
        >
          {filteredCountries.length > 0 ? (
            filteredCountries.map((country, index) => (
              <button
                key={country.value}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm border-b last:border-b-0 focus:bg-accent focus:text-accent-foreground focus:outline-none",
                  value === country.value && "bg-accent text-accent-foreground",
                  highlightedIndex === index && "bg-muted"
                )}
                onMouseDown={(e) => {
                  // Prevent input blur when clicking on option
                  e.preventDefault();
                  handleCountrySelect(country);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                role="option"
                aria-selected={value === country.value}
              >
                {country.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No countries found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
