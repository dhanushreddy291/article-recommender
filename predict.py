from helpers.db_connector import get_db_connection
import keras
import numpy as np
import pandas as pd

if __name__ == "__main__":
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, embedding
        FROM newsletter
        WHERE predicted_value IS NULL
        """
    )
    rows = cur.fetchall()

    if len(rows) == 0:
        print("No new values to predict")
    else:
        # Convert to dataframe
        df = pd.DataFrame(rows, columns=["id", "embedding"])

        # Convert embeddings to numeric type
        df["embedding"] = df["embedding"].apply(
            lambda x: np.fromstring(x[1:-1], sep=",").astype(np.float32)
        )

        # Predict the value
        classifier = keras.models.load_model("classification_model.keras")
        predictions = classifier.predict(np.stack(df["embedding"].values))

        for i in range(len(predictions)):
            predicted_value = int(np.argmax(predictions[i]).astype(np.uint8))
            cur.execute(
                """
                UPDATE newsletter
                SET predicted_value = %s
                WHERE id = %s
                """,
                (predicted_value, rows[i][0]),
            )

        print("Predicted all values")
    conn.close()
