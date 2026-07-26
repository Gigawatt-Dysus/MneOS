import React from "react";
import { Carousel } from "react-carousel3";
import image1 from "./images/image1.jpg";
import image2 from "./images/image2.jpg";
import image3 from "./images/image3.jpg";
import image4 from "./images/image4.jpg";
import image5 from "./images/image5.jpg";
import image6 from "./images/image6.jpg";
import image7 from "./images/image7.jpg";
import image8 from "./images/image8.jpg";
import image9 from "./images/image9.jpg";
import image10 from "./images/image10.jpg";

const style = {
  width: 10,
  height: 30
};
const imgStyle = {
  padding: "2px",
  background: "black",
  borderRadius: "20px",
};
const images = [image1, image2, image3, image4, image5, image6, image7, image8, image9, image10];
export default function App() {
  return (
    
    <div
      style={{
        margin: "0px",
        padding: "0px",
        display: "flex",
        justifyContent: "center",
        background: "linear-gradient(to bottom,  white 0%, gray 100%)"
      }}
    >
      <Carousel
        height={"100vh"}
        width={700}
        yOrigin={0}
        xOrigin={0}
        yRadius={50}
        xRadius={600}
      >
        {images.map((image, index) => (
          <div key={index} style={style}>
            <img alt="" src={image} style={imgStyle} />
          </div>
        ))}
      </Carousel>
    </div>
  );
}
