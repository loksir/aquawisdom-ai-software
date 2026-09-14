import React, { FC, useState, useEffect } from "react";
import Nav from "../areas/Nav";
import SideBar from "../areas/sidebar/SideBar";
import LeftMenu from "../areas/LeftMenu";
import Main from "../areas/main/Main";
import RightMenu from "../areas/rightmenu/RightMenu";
import { isOnHomeWiFi } from "../../utils/network";
import "./Home.css";

const Home: FC = () => {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const online = await isOnHomeWiFi();
      setIsOnline(online);
    };
    checkStatus();
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="screen-root-container home-container">
      <div className="navigation">
        <Nav />
      </div>
      
      {/* Only show Refresh button when online at home */}
      {isOnline && (
        <div className="refresh-button-container">
          <button onClick={handleRefresh} className="refresh-button">
            Refresh Page
          </button>
        </div>
      )}
      
      <SideBar />
      <LeftMenu />
      <Main />
      <RightMenu />
    </div>
  );
};

export default Home;

// import React, { FC } from "react";
// import Nav from "../areas/Nav";
// import SideBar from "../areas/sidebar/SideBar";
// import LeftMenu from "../areas/LeftMenu";
// import Main from "../areas/main/Main";
// import RightMenu from "../areas/rightmenu/RightMenu";
// import "./Home.css";

// const Home: FC = () => {

//    const handleRefresh = () => {
//     // Reloads the entire page from the server, bypassing the cache if 'true' is passed
//     window.location.reload(); 
//   };
//   return (
//     <div className="screen-root-container home-container">
//       <div className="navigation">
//         <Nav />
//       </div>
//       <div className="refresh-button-container">
//         <button onClick={handleRefresh} className="refresh-button">
//           Refresh Page
//         </button>
//       </div>
//       <SideBar />
//       <LeftMenu />
//       <Main />
//       <RightMenu />
//     </div>
//   );
// };

// export default Home;