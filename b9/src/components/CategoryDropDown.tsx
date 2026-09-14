import React, { FC, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { AppState } from "../store/AppState";
import "react-dropdown/style.css";
import Category from "../models/Category";
import DropDown, { Option } from "react-dropdown";
import { useNavigate } from "react-router-dom";
import { database } from "../db/Database"; // IMPORT DATABASE

const defaultLabel = "Select a category";
const defaultOption = {
  value: "0",
  label: defaultLabel,
};

class CategoryDropDownProps {
  sendOutSelectedCategory?: (cat: Category) => void;
  Navigate?: boolean = false;
  preselectedCategory?: Category;
}

const CategoryDropDown: FC<CategoryDropDownProps> = ({
  sendOutSelectedCategory,
  Navigate,
  preselectedCategory,
}) => {
  const reduxCategories = useSelector((state: AppState) => state.categories);
  const [categoryOptions, setCategoryOptions] = useState<
    Array<string | Option>
  >([defaultOption]);
  const [selectedOption, setSelectedOption] = useState<Option>(defaultOption);
  const navigate = useNavigate();

  useEffect(() => {
    const loadCats = async () => {
      // 1. Try to get categories from Redux (Online)
      let cats = reduxCategories;

      // 2. If Redux is empty (Offline), fall back to SQLite!
      if (!cats || cats.length === 0) {
        try {
          cats = await database.getCategories();
        } catch (e) {
          console.error("SQLite read error", e);
        }
      }

      // 3. Populate the dropdown
      if (cats && cats.length > 0) {
        const catOptions: Array<Option> = cats.map((cat: Category) => {
          return {
            value: cat.id,
            label: cat.name,
          };
        });
        setCategoryOptions(catOptions);
        setSelectedOption({
          value: preselectedCategory ? preselectedCategory.id : "0",
          label: preselectedCategory ? preselectedCategory.name : defaultLabel,
        });
      }
    };

    loadCats();
  }, [reduxCategories, preselectedCategory]);

  const onChangeDropDown = (selected: Option) => {
    setSelectedOption(selected);
    if (sendOutSelectedCategory) {
      sendOutSelectedCategory(
        new Category(selected.value, selected.label?.valueOf().toString() ?? "")
      );
    }

    if (Navigate) {
      navigate(`/categorythreads/${selected.value}`);
    }
  };

  return (
    <DropDown
      className="thread-category-dropdown"
      options={categoryOptions}
      onChange={onChangeDropDown}
      value={selectedOption}
      placeholder={defaultLabel}
    />
  );
};

export default CategoryDropDown;

// import React, { FC, useEffect, useState } from "react";
// import { useSelector } from "react-redux";
// import { AppState } from "../store/AppState";
// import "react-dropdown/style.css";
// import Category from "../models/Category";
// import DropDown, { Option } from "react-dropdown";
// import { useNavigate } from "react-router-dom";

// const defaultLabel = "Select a category";
// const defaultOption = {
//   value: "0",
//   label: defaultLabel,
// };

// class CategoryDropDownProps {
//   sendOutSelectedCategory?: (cat: Category) => void;
//   Navigate?: boolean = false;
//   preselectedCategory?: Category;
// }

// const CategoryDropDown: FC<CategoryDropDownProps> = ({
//   sendOutSelectedCategory,
//   Navigate,
//   preselectedCategory,
// }) => {
//   const categories = useSelector((state: AppState) => state.categories);
//   const [categoryOptions, setCategoryOptions] = useState<
//     Array<string | Option>
//   >([defaultOption]);
//   const [selectedOption, setSelectedOption] = useState<Option>(defaultOption);
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (categories) {
//       const catOptions: Array<Option> = categories.map((cat: Category) => {
//         return {
//           value: cat.id,
//           label: cat.name,
//         };
//       });
//       setCategoryOptions(catOptions);
//       setSelectedOption({
//         value: preselectedCategory ? preselectedCategory.id : "0",
//         label: preselectedCategory ? preselectedCategory.name : defaultLabel,
//       });
//     }
//   }, [categories, preselectedCategory]);

//   const onChangeDropDown = (selected: Option) => {
//     setSelectedOption(selected);
//     if (sendOutSelectedCategory) {
//       sendOutSelectedCategory(
//         new Category(selected.value, selected.label?.valueOf().toString() ?? "")
//       );
//     }

//     if (Navigate) {
//       navigate(`/categorythreads/${selected.value}`);
//     }
//   };

//   return (
//     <DropDown
//       className="thread-category-dropdown"
//       options={categoryOptions}
//       onChange={onChangeDropDown}
//       value={selectedOption}
//       placeholder={defaultLabel}
//     />
//   );
// };

// export default CategoryDropDown;